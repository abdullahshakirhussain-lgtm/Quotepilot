"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, requireUser } from "@/lib/supabase/server";
import { CURRENCIES, QUOTE_STATUSES, type QuoteStatus } from "@/lib/constants";
import { clip, optionalString, requireString } from "@/lib/utils";
import { requestToday } from "@/lib/request-time";
import {
  applyQuoteStatusChange,
  recomputeQuoteFollowUpState,
} from "@/lib/quote-state";

export interface QuoteActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

export interface LogFollowUpResult {
  logged: boolean;
  message?: string;
  followUpNumber?: number;
  nextFollowUpAt?: string | null;
}

const MAX_SNAPSHOT_LENGTH = 10_000;

function revalidateQuoteViews() {
  revalidatePath("/quotes");
  revalidatePath("/follow-ups");
  revalidatePath("/dashboard");
  revalidatePath("/pipeline");
  revalidatePath("/leads");
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

function isQuoteStatus(value: unknown): value is QuoteStatus {
  return typeof value === "string" && (QUOTE_STATUSES as readonly string[]).includes(value);
}

function parseAmount(value: FormDataEntryValue | null): number {
  const n = Number(String(value ?? "").replace(/[, ]/g, ""));
  if (!Number.isFinite(n) || n < 0) throw new Error("Amount must be a positive number.");
  return Math.round(n * 100) / 100;
}

function parseDate(value: FormDataEntryValue | null, field: string): string | null {
  const s = optionalString(value);
  if (s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`${field} is not a valid date.`);
  return s;
}

/**
 * The quote's own fields. Status is never read from forms — it only changes
 * through markQuoteSent / setQuoteStatus, so reminders always stay in sync.
 */
function readQuoteFields(formData: FormData, today: string) {
  const currency = requireString(formData.get("currency"), "Currency").toUpperCase();
  if (!(CURRENCIES as readonly string[]).includes(currency)) {
    throw new Error("Unsupported currency.");
  }
  const quoteDate = parseDate(formData.get("quote_date"), "Quote date") ?? today;
  const validUntil = parseDate(formData.get("valid_until"), "Valid-until date");
  if (validUntil && validUntil < quoteDate) {
    throw new Error("Valid-until date can't be before the quote date.");
  }
  return {
    title: requireString(formData.get("title"), "Quote title"),
    description: optionalString(formData.get("description")),
    amount: parseAmount(formData.get("amount")),
    currency,
    quote_date: quoteDate,
    valid_until: validUntil,
    notes: optionalString(formData.get("notes")),
  };
}

/** A quote may only point at one of the caller's own leads (RLS enforces it too). */
async function assertOwnLead(supabase: SupabaseClient, userId: string, leadId: string) {
  const { data, error } = await supabase
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("The selected customer was not found.");
}

export async function updateQuote(
  _prev: QuoteActionState,
  formData: FormData
): Promise<QuoteActionState> {
  const user = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing quote id." };

  let fields;
  let leadId: string;
  try {
    fields = readQuoteFields(formData, await requestToday());
    leadId = requireString(formData.get("lead_id"), "Customer");
  } catch (e) {
    return { error: errorMessage(e) };
  }

  const supabase = await createClient();
  try {
    const { data: existing, error: readError } = await supabase
      .from("quotes")
      .select("id, lead_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!existing) return { error: "Quote not found." };

    await assertOwnLead(supabase, user.id, leadId);

    const { error } = await supabase
      .from("quotes")
      .update({ ...fields, lead_id: leadId })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);

    // Reminders and message history also record the customer. Keep them on the
    // same customer as their quote, otherwise deleting the old customer would
    // cascade-delete this quote's reminders.
    if (existing.lead_id !== leadId) {
      for (const table of ["follow_ups", "messages"] as const) {
        const { error: moveError } = await supabase
          .from(table)
          .update({ lead_id: leadId })
          .eq("quote_id", id)
          .eq("user_id", user.id);
        if (moveError) throw new Error(moveError.message);
      }
    }
  } catch (e) {
    return { error: errorMessage(e) };
  }

  revalidateQuoteViews();
  return { ok: true, message: "Quote updated." };
}

export async function deleteQuote(id: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(`Could not delete quote: ${error.message}`);
  revalidateQuoteViews();
}

export async function markQuoteSent(id: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: quote, error } = await supabase
    .from("quotes")
    .select("id, lead_id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  // Idempotent: a repeated click must not reschedule an already-sent quote.
  if (!quote || quote.status === "sent") return;

  // The quote date is the first-send date; re-sending from a later stage keeps it.
  const patch =
    quote.status === "draft"
      ? { status: "sent", quote_date: await requestToday() }
      : { status: "sent" };
  const { error: updateError } = await supabase
    .from("quotes")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id);
  if (updateError) throw new Error(updateError.message);

  await applyQuoteStatusChange(supabase, user.id, quote, quote.status, "sent");
  revalidateQuoteViews();
}

export async function setQuoteStatus(id: string, status: QuoteStatus): Promise<void> {
  if (!isQuoteStatus(status)) throw new Error("Invalid quote status.");
  if (status === "sent") return markQuoteSent(id);

  const user = await requireUser();
  const supabase = await createClient();

  const { data: quote, error } = await supabase
    .from("quotes")
    .select("id, lead_id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!quote || quote.status === status) return;

  const { error: updateError } = await supabase
    .from("quotes")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id);
  if (updateError) throw new Error(updateError.message);

  await applyQuoteStatusChange(supabase, user.id, quote, quote.status, status);
  revalidateQuoteViews();
}

/**
 * Records that a follow-up was sent: completes the earliest pending reminder
 * (storing the final, possibly edited, message text on it) and re-derives the
 * quote's counters. Reports honestly when there was nothing to complete.
 */
export async function logFollowUpSent(
  quoteId: string,
  messageSnapshot?: string | null
): Promise<LogFollowUpResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: pending, error } = await supabase
    .from("follow_ups")
    .select("id, follow_up_number")
    .eq("quote_id", quoteId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("due_date", { ascending: true })
    .limit(1);
  if (error) throw new Error(error.message);

  if (!pending?.length) {
    return {
      logged: false,
      message:
        "This quote has no pending reminder, so nothing was logged. Mark the quote as sent to schedule reminders.",
    };
  }

  const { error: updateError } = await supabase
    .from("follow_ups")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      message_snapshot: messageSnapshot ? clip(messageSnapshot, MAX_SNAPSHOT_LENGTH) : null,
    })
    .eq("id", pending[0].id)
    .eq("user_id", user.id);
  if (updateError) throw new Error(updateError.message);

  const state = await recomputeQuoteFollowUpState(supabase, user.id, quoteId);
  revalidateQuoteViews();
  return {
    logged: true,
    followUpNumber: pending[0].follow_up_number,
    nextFollowUpAt: state.next_follow_up_at,
  };
}

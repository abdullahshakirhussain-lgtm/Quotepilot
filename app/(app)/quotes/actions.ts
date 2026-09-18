"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, requireUser } from "@/lib/supabase/server";
import { CURRENCIES, QUOTE_STATUSES, type QuoteStatus } from "@/lib/constants";
import { addDays, clip, daysBetween, optionalString, requireString } from "@/lib/utils";
import { requestToday } from "@/lib/request-time";
import { EARLIEST_SENT_DATE, isRealDate, LIMITS, MAX_AMOUNT } from "@/lib/quote-flows";
import {
  applyQuoteStatusChange,
  CLOSED_QUOTE_STATUSES,
  recomputeQuoteFollowUpState,
  skipRemindersCoveredBy,
} from "@/lib/quote-state";
import type { ActionResult } from "@/lib/types";

export interface QuoteActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

export interface LogFollowUpResult {
  logged: boolean;
  message?: string;
  /** The attempt failed (as opposed to there being nothing to log). */
  failed?: boolean;
  followUpNumber?: number;
  nextFollowUpAt?: string | null;
}

const MAX_SNAPSHOT_LENGTH = 10_000;

/** Statuses of a quote that is out with the customer and still undecided. */
const OPEN_STATUSES: QuoteStatus[] = ["sent", "follow_up_due", "negotiating"];

const QUOTE_GONE = "This quote no longer exists. It may have been deleted in another tab.";
const TRY_AGAIN = "The quote couldn't be updated just now. Refresh the page and try again.";

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

/** A problem with what the user typed: its message is safe to show as-is. */
class InputError extends Error {}

function parseAmount(value: FormDataEntryValue | null): number {
  const n = Number(String(value ?? "").replace(/[, ]/g, ""));
  if (!String(value ?? "").trim() || !Number.isFinite(n) || n <= 0) {
    throw new InputError("Enter the quote amount as a number greater than zero.");
  }
  if (n > MAX_AMOUNT) throw new InputError("That amount is too large. Check the number and try again.");
  return Math.round(n * 100) / 100;
}

function parseDate(value: FormDataEntryValue | null, field: string): string | null {
  const s = optionalString(value);
  if (s && !isRealDate(s)) throw new InputError(`${field} isn't a real date. Check it and try again.`);
  return s;
}

/** Longer text is refused with a message rather than cut. */
function withinLimit(value: string | null, max: number, label: string): string | null {
  if (value && value.length > max) {
    throw new InputError(`${label} is too long. Keep it under ${max.toLocaleString("en-US")} characters.`);
  }
  return value;
}

/**
 * The quote's own fields. Status is never read from forms — it only changes
 * through markQuoteSent / setQuoteStatus, so reminders always stay in sync.
 */
function readQuoteFields(formData: FormData, today: string) {
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  if (!(CURRENCIES as readonly string[]).includes(currency)) {
    throw new InputError("Choose a currency.");
  }
  const title = optionalString(formData.get("title"));
  if (!title) throw new InputError("Add a short title for the quote.");
  const quoteDate = parseDate(formData.get("quote_date"), "The sent date") ?? today;
  const validUntil = parseDate(formData.get("valid_until"), "The valid-until date");
  if (validUntil && validUntil < quoteDate) {
    throw new InputError("The valid-until date can't be before the sent date.");
  }
  return {
    title: withinLimit(title, LIMITS.title, "The quote title")!,
    description: withinLimit(optionalString(formData.get("description")), LIMITS.description, "The description"),
    amount: parseAmount(formData.get("amount")),
    currency,
    quote_date: quoteDate,
    valid_until: validUntil,
    notes: withinLimit(optionalString(formData.get("notes")), LIMITS.notes, "The notes"),
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
  if (!data) throw new InputError("The selected customer was not found. It may have been deleted in another tab.");
}

/**
 * Reminders count from the day a quote went out, so correcting that date moves
 * the reminders still waiting by the same number of days. Done and skipped
 * ones are history and stay as they were.
 */
async function shiftPendingReminders(
  supabase: SupabaseClient,
  userId: string,
  quoteId: string,
  days: number
): Promise<void> {
  const { data, error } = await supabase
    .from("follow_ups")
    .select("id, due_date")
    .eq("quote_id", quoteId)
    .eq("user_id", userId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  for (const reminder of data ?? []) {
    const { error: moveError } = await supabase
      .from("follow_ups")
      .update({ due_date: addDays(String(reminder.due_date).slice(0, 10), days) })
      .eq("id", reminder.id)
      .eq("user_id", userId)
      .eq("status", "pending");
    if (moveError) throw new Error(moveError.message);
  }
  await recomputeQuoteFollowUpState(supabase, userId, quoteId);
}

export async function updateQuote(
  _prev: QuoteActionState,
  formData: FormData
): Promise<QuoteActionState> {
  const user = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: QUOTE_GONE };

  const today = await requestToday();
  let fields;
  let leadId: string;
  try {
    fields = readQuoteFields(formData, today);
    leadId = requireString(formData.get("lead_id"), "Customer");
  } catch (e) {
    return { error: e instanceof InputError ? e.message : "Choose which customer this quote is for." };
  }

  const supabase = await createClient();
  let shift = 0;
  try {
    const { data: existing, error: readError } = await supabase
      .from("quotes")
      .select("id, lead_id, status, quote_date")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!existing) return { error: QUOTE_GONE };

    // A quote that went out can't have been sent in the future, or in the 0020s.
    if (existing.status !== "draft") {
      if (fields.quote_date > today) return { error: "The sent date can't be in the future." };
      if (fields.quote_date < EARLIEST_SENT_DATE) {
        return { error: "That sent date looks too far in the past. Check the year." };
      }
    }

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

    if (existing.quote_date && OPEN_STATUSES.includes(existing.status as QuoteStatus)) {
      shift = daysBetween(String(existing.quote_date).slice(0, 10), fields.quote_date);
    }
  } catch (e) {
    // Our own wording is safe to show; database errors are not.
    if (e instanceof InputError) return { error: e.message };
    console.error("[quotes] updating a quote failed:", errorMessage(e));
    revalidateQuoteViews();
    return { error: "The quote couldn't be saved just now. Please try again." };
  }

  let message = "Quote updated.";
  if (shift !== 0) {
    try {
      await shiftPendingReminders(supabase, user.id, id, shift);
      message = "Quote updated. Its follow-up reminders moved with the new sent date.";
    } catch (e) {
      console.error("[quotes] moving reminders after a sent-date change failed:", errorMessage(e));
      message =
        "Quote updated, but its follow-up reminders couldn't all be moved to match the new sent date. Check them on the Follow-ups page.";
    }
  }

  revalidateQuoteViews();
  return { ok: true, message };
}

export async function deleteQuote(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("quotes")
    .delete()
    .eq("id", String(id ?? ""))
    .eq("user_id", user.id);
  if (error) {
    console.error("[quotes] deleting a quote failed:", error.message);
    return { ok: false, error: "The quote couldn't be deleted just now. Please try again." };
  }
  // Already gone (e.g. deleted in another tab) is fine: the list just refreshes.
  revalidateQuoteViews();
  return { ok: true };
}

export async function markQuoteSent(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  try {
    const { data: quote, error } = await supabase
      .from("quotes")
      .select("id, lead_id, status, quote_date")
      .eq("id", String(id ?? ""))
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!quote) return { ok: false, error: QUOTE_GONE };

    if (quote.status === "sent") {
      // Idempotent: a repeated click must not reschedule an already-sent quote.
      // The one exception repairs a quote whose reminders were never written
      // (an earlier attempt failed half way), so "try again" can finish it.
      const { count, error: countError } = await supabase
        .from("follow_ups")
        .select("id", { count: "exact", head: true })
        .eq("quote_id", quote.id)
        .eq("user_id", user.id);
      if (countError) throw new Error(countError.message);
      if (count === 0) {
        await applyQuoteStatusChange(supabase, user.id, quote, "draft", "sent", {
          scheduleFrom: String(quote.quote_date ?? "").slice(0, 10) || undefined,
        });
        revalidateQuoteViews();
      }
      return { ok: true };
    }

    // The quote date is the first-send date; re-sending from a later stage keeps it.
    const patch =
      quote.status === "draft"
        ? { status: "sent", quote_date: await requestToday() }
        : { status: "sent" };
    const { error: updateError } = await supabase
      .from("quotes")
      .update(patch)
      .eq("id", quote.id)
      .eq("user_id", user.id);
    if (updateError) throw new Error(updateError.message);

    await applyQuoteStatusChange(supabase, user.id, quote, quote.status, "sent");
  } catch (e) {
    console.error("[quotes] marking a quote sent failed:", errorMessage(e));
    revalidateQuoteViews();
    return { ok: false, error: TRY_AGAIN };
  }

  revalidateQuoteViews();
  return { ok: true };
}

export async function setQuoteStatus(id: string, status: QuoteStatus): Promise<ActionResult> {
  if (!isQuoteStatus(status)) return { ok: false, error: "That isn't a quote status QuoteLoop knows." };
  if (status === "sent") return markQuoteSent(id);

  const user = await requireUser();
  const supabase = await createClient();

  try {
    const { data: quote, error } = await supabase
      .from("quotes")
      .select("id, lead_id, status")
      .eq("id", String(id ?? ""))
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!quote) return { ok: false, error: QUOTE_GONE };

    if (quote.status === status) {
      // Already there (a double click, another tab). For a closed quote, make
      // sure no reminder was left open by an earlier attempt that failed.
      if (CLOSED_QUOTE_STATUSES.includes(status)) {
        const { error: closeError } = await supabase
          .from("follow_ups")
          .update({ status: "skipped" })
          .eq("quote_id", quote.id)
          .eq("user_id", user.id)
          .eq("status", "pending");
        if (closeError) throw new Error(closeError.message);
        await recomputeQuoteFollowUpState(supabase, user.id, quote.id);
        revalidateQuoteViews();
      }
      return { ok: true };
    }

    const { error: updateError } = await supabase
      .from("quotes")
      .update({ status })
      .eq("id", quote.id)
      .eq("user_id", user.id);
    if (updateError) throw new Error(updateError.message);

    await applyQuoteStatusChange(supabase, user.id, quote, quote.status, status);
  } catch (e) {
    console.error("[quotes] changing a quote's status failed:", errorMessage(e));
    revalidateQuoteViews();
    return { ok: false, error: TRY_AGAIN };
  }

  revalidateQuoteViews();
  return { ok: true };
}

/**
 * Records that a follow-up was sent: completes the earliest pending reminder
 * (storing the final, possibly edited, message text on it) and re-derives the
 * quote's counters. Reports honestly when there was nothing to complete.
 *
 * `expectedFollowUpId` is the reminder that was due when the user opened the
 * message. If another tab has recorded it since, nothing is logged: otherwise
 * this would quietly use up the NEXT reminder too.
 */
export async function logFollowUpSent(
  quoteId: string,
  messageSnapshot?: string | null,
  expectedFollowUpId?: string | null
): Promise<LogFollowUpResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const alreadyRecorded: LogFollowUpResult = {
    logged: false,
    message: "This follow-up was already recorded, maybe in another tab, so nothing new was logged.",
  };

  try {
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("id")
      .eq("id", String(quoteId ?? ""))
      .eq("user_id", user.id)
      .maybeSingle();
    if (quoteError) throw new Error(quoteError.message);
    if (!quote) return { logged: false, message: `${QUOTE_GONE} Nothing was logged.` };

    const { data: pending, error } = await supabase
      .from("follow_ups")
      .select("id, follow_up_number")
      .eq("quote_id", quote.id)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("due_date", { ascending: true })
      .limit(1);
    if (error) throw new Error(error.message);

    if (typeof expectedFollowUpId === "string" && expectedFollowUpId && pending?.[0]?.id !== expectedFollowUpId) {
      return alreadyRecorded;
    }
    if (!pending?.length) {
      return {
        logged: false,
        message: "There's no follow-up reminder left on this quote, so there was nothing to log.",
      };
    }

    const { data: updated, error: updateError } = await supabase
      .from("follow_ups")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        message_snapshot: messageSnapshot ? clip(messageSnapshot, MAX_SNAPSHOT_LENGTH) : null,
      })
      .eq("id", pending[0].id)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .select("id");
    if (updateError) throw new Error(updateError.message);
    if (!updated?.length) return alreadyRecorded;

    // This follow-up also covers any other reminder for the quote that was due.
    await skipRemindersCoveredBy(supabase, user.id, quote.id, pending[0].id, await requestToday());
    const state = await recomputeQuoteFollowUpState(supabase, user.id, quote.id);
    revalidateQuoteViews();
    return {
      logged: true,
      followUpNumber: pending[0].follow_up_number,
      nextFollowUpAt: state.next_follow_up_at,
    };
  } catch (e) {
    console.error("[quotes] logging a follow-up failed:", errorMessage(e));
    revalidateQuoteViews();
    return {
      logged: false,
      failed: true,
      message: "The follow-up couldn't be logged just now. Check the quote's follow-ups, then try again.",
    };
  }
}

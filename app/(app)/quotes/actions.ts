"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import {
  DEFAULT_FOLLOW_UP_DAYS,
  QUOTE_STATUSES,
  type QuoteStatus,
} from "@/lib/constants";
import { addDays, optionalString, requireString, todayISO } from "@/lib/utils";

export interface QuoteActionState {
  ok?: boolean;
  error?: string;
}

function revalidateQuoteViews() {
  revalidatePath("/quotes");
  revalidatePath("/follow-ups");
  revalidatePath("/dashboard");
  revalidatePath("/pipeline");
  revalidatePath("/leads");
}

function parseQuoteStatus(value: FormDataEntryValue | null): QuoteStatus {
  const v = String(value ?? "draft");
  return (QUOTE_STATUSES as readonly string[]).includes(v)
    ? (v as QuoteStatus)
    : "draft";
}

function parseAmount(value: FormDataEntryValue | null): number {
  const n = Number(String(value ?? "").replace(/[, ]/g, ""));
  if (!Number.isFinite(n) || n < 0) throw new Error("Amount must be a positive number.");
  return Math.round(n * 100) / 100;
}

export async function createQuote(
  _prev: QuoteActionState,
  formData: FormData
): Promise<QuoteActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let payload;
  const status = parseQuoteStatus(formData.get("status"));
  try {
    payload = {
      user_id: user.id,
      lead_id: requireString(formData.get("lead_id"), "Lead"),
      title: requireString(formData.get("title"), "Title"),
      description: optionalString(formData.get("description")),
      amount: parseAmount(formData.get("amount")),
      currency: requireString(formData.get("currency"), "Currency"),
      quote_date: optionalString(formData.get("quote_date")) ?? todayISO(),
      valid_until: optionalString(formData.get("valid_until")),
      status,
      notes: optionalString(formData.get("notes")),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid input." };
  }

  const supabase = await createClient();
  const { data: quote, error } = await supabase
    .from("quotes")
    .insert(payload)
    .select("id")
    .single();
  if (error) return { error: error.message };

  // If created directly as "sent", schedule the follow-ups immediately.
  if (status === "sent" && quote) {
    await scheduleFollowUps(quote.id);
  }

  revalidateQuoteViews();
  return { ok: true };
}

export async function updateQuote(
  _prev: QuoteActionState,
  formData: FormData
): Promise<QuoteActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing quote id." };

  let payload;
  try {
    payload = {
      lead_id: requireString(formData.get("lead_id"), "Lead"),
      title: requireString(formData.get("title"), "Title"),
      description: optionalString(formData.get("description")),
      amount: parseAmount(formData.get("amount")),
      currency: requireString(formData.get("currency"), "Currency"),
      quote_date: optionalString(formData.get("quote_date")) ?? todayISO(),
      valid_until: optionalString(formData.get("valid_until")),
      status: parseQuoteStatus(formData.get("status")),
      notes: optionalString(formData.get("notes")),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("quotes")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidateQuoteViews();
  return { ok: true };
}

export async function deleteQuote(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  await supabase.from("quotes").delete().eq("id", id).eq("user_id", user.id);
  revalidateQuoteViews();
}

/**
 * Creates default follow-up reminders for a quote based on the business's
 * configured schedule, and sets next_follow_up_at to the earliest one.
 * Existing *pending* follow-ups for the quote are replaced; completed ones stay.
 */
async function scheduleFollowUps(quoteId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, lead_id, user_id")
    .eq("id", quoteId)
    .eq("user_id", user.id)
    .single();
  if (!quote) return;

  const { data: business } = await supabase
    .from("businesses")
    .select("default_follow_up_days")
    .eq("user_id", user.id)
    .single();

  const days: number[] =
    business?.default_follow_up_days?.length
      ? business.default_follow_up_days
      : DEFAULT_FOLLOW_UP_DAYS;

  const base = todayISO();

  // Remove existing pending reminders to avoid duplicates.
  await supabase
    .from("follow_ups")
    .delete()
    .eq("quote_id", quoteId)
    .eq("user_id", user.id)
    .eq("status", "pending");

  const rows = days
    .slice()
    .sort((a, b) => a - b)
    .map((d, i) => ({
      user_id: user.id,
      quote_id: quoteId,
      lead_id: quote.lead_id,
      due_date: addDays(base, d),
      status: "pending" as const,
      follow_up_number: i + 1,
    }));

  await supabase.from("follow_ups").insert(rows);

  const earliest = rows.length ? rows[0].due_date : null;
  await supabase
    .from("quotes")
    .update({ next_follow_up_at: earliest ? earliest + "T09:00:00Z" : null })
    .eq("id", quoteId)
    .eq("user_id", user.id);
}

export async function markQuoteSent(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, lead_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!quote) return;

  await supabase
    .from("quotes")
    .update({ status: "sent", quote_date: todayISO() })
    .eq("id", id)
    .eq("user_id", user.id);

  await scheduleFollowUps(id);

  // Move the lead along the pipeline.
  await supabase
    .from("leads")
    .update({ status: "quote_sent" })
    .eq("id", quote.lead_id)
    .eq("user_id", user.id)
    .in("status", ["new", "contacted"]);

  revalidateQuoteViews();
}

export async function setQuoteStatus(
  id: string,
  status: QuoteStatus
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const patch: Record<string, unknown> = { status };
  // Accepted / rejected / expired quotes have no more follow-ups pending.
  if (["accepted", "rejected", "expired"].includes(status)) {
    patch.next_follow_up_at = null;
  }

  await supabase
    .from("quotes")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id);

  // Also clear pending reminders for closed quotes.
  if (["accepted", "rejected", "expired"].includes(status)) {
    await supabase
      .from("follow_ups")
      .update({ status: "skipped" })
      .eq("quote_id", id)
      .eq("user_id", user.id)
      .eq("status", "pending");
  }

  revalidateQuoteViews();
}

/**
 * Records that a follow-up was sent for this quote: completes the earliest
 * pending reminder, then recomputes the quote's follow-up bookkeeping from its
 * follow_ups rows. Recomputing (rather than incrementing) keeps this consistent
 * with the Follow-ups page's complete/skip/reopen actions.
 */
export async function logFollowUpSent(
  quoteId: string,
  messageSnapshot?: string | null
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const now = new Date().toISOString();

  // Complete the earliest pending reminder, if one exists.
  const { data: pending } = await supabase
    .from("follow_ups")
    .select("id")
    .eq("quote_id", quoteId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("due_date", { ascending: true })
    .limit(1);

  if (pending && pending[0]) {
    await supabase
      .from("follow_ups")
      .update({
        status: "completed",
        completed_at: now,
        message_snapshot: messageSnapshot ?? null,
      })
      .eq("id", pending[0].id)
      .eq("user_id", user.id);
  }

  // Recompute counters from the rows so they always match reality.
  const { data: rows } = await supabase
    .from("follow_ups")
    .select("status, due_date, completed_at")
    .eq("quote_id", quoteId)
    .eq("user_id", user.id);

  const list = rows ?? [];
  const completed = list.filter((r) => r.status === "completed");
  const nextPending = list
    .filter((r) => r.status === "pending")
    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1))[0];
  const lastCompletedAt = completed
    .map((r) => r.completed_at)
    .filter(Boolean)
    .sort()
    .pop();

  await supabase
    .from("quotes")
    .update({
      follow_up_count: completed.length,
      last_follow_up_at: lastCompletedAt ?? null,
      next_follow_up_at: nextPending ? nextPending.due_date + "T09:00:00Z" : null,
    })
    .eq("id", quoteId)
    .eq("user_id", user.id);

  revalidateQuoteViews();
}

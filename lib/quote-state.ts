// ---------------------------------------------------------------------------
// Server-side quote/follow-up write helpers. Every status change — from the
// status buttons, the status dropdown or the edit form — goes through
// applyQuoteStatusChange, so reminders, counters and the lead's pipeline stage
// are updated the same way no matter which UI path was used.
// ---------------------------------------------------------------------------
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_FOLLOW_UP_DAYS, type QuoteStatus } from "./constants";
import { addDays } from "./utils";
import { requestToday } from "./request-time";
import { deriveQuoteFollowUpState, nextFollowUpNumber } from "./follow-up-state";

export const CLOSED_QUOTE_STATUSES: QuoteStatus[] = ["accepted", "rejected", "expired"];

function check(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

/** Only whole days between 1 and 365 are valid reminder offsets. */
export function sanitizeFollowUpDays(value: unknown): number[] {
  const days = Array.isArray(value)
    ? value.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 365)
    : [];
  const unique = Array.from(new Set(days)).sort((a, b) => a - b).slice(0, 10);
  return unique.length ? unique : DEFAULT_FOLLOW_UP_DAYS;
}

/** Re-derives follow_up_count / last / next on the quote from its reminder rows. */
export async function recomputeQuoteFollowUpState(
  supabase: SupabaseClient,
  userId: string,
  quoteId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("follow_ups")
    .select("status, due_date, completed_at")
    .eq("quote_id", quoteId)
    .eq("user_id", userId);
  check(error, "Could not read follow-ups");

  const { error: updateError } = await supabase
    .from("quotes")
    .update(deriveQuoteFollowUpState(data ?? []))
    .eq("id", quoteId)
    .eq("user_id", userId);
  check(updateError, "Could not update quote");
}

/**
 * Replaces a quote's pending reminders with a fresh schedule (today + each
 * configured day). Completed/skipped history is kept and numbering continues
 * after it.
 */
export async function scheduleFollowUps(
  supabase: SupabaseClient,
  userId: string,
  quoteId: string,
  leadId: string
): Promise<void> {
  const { data: business } = await supabase
    .from("businesses")
    .select("default_follow_up_days")
    .eq("user_id", userId)
    .maybeSingle();
  const days = sanitizeFollowUpDays(business?.default_follow_up_days);

  const { error: deleteError } = await supabase
    .from("follow_ups")
    .delete()
    .eq("quote_id", quoteId)
    .eq("user_id", userId)
    .eq("status", "pending");
  check(deleteError, "Could not reset reminders");

  const { data: history, error: historyError } = await supabase
    .from("follow_ups")
    .select("follow_up_number")
    .eq("quote_id", quoteId)
    .eq("user_id", userId);
  check(historyError, "Could not read reminder history");

  const start = nextFollowUpNumber(history ?? []);
  // Reminder dates count from the user's own local day.
  const base = await requestToday();
  const rows = days.map((d, i) => ({
    user_id: userId,
    quote_id: quoteId,
    lead_id: leadId,
    due_date: addDays(base, d),
    status: "pending" as const,
    follow_up_number: start + i,
  }));

  const { error: insertError } = await supabase.from("follow_ups").insert(rows);
  check(insertError, "Could not schedule reminders");
}

/** Keeps the lead's pipeline stage in line with its quote's outcome. */
async function syncLeadForQuoteStatus(
  supabase: SupabaseClient,
  userId: string,
  leadId: string,
  next: QuoteStatus
): Promise<void> {
  if (next === "sent") {
    // Only advance early-stage leads; never drag a later stage backwards.
    const { error } = await supabase
      .from("leads")
      .update({ status: "quote_sent" })
      .eq("id", leadId)
      .eq("user_id", userId)
      .in("status", ["new", "contacted"]);
    check(error, "Could not update lead");
  } else if (next === "accepted") {
    const { error } = await supabase
      .from("leads")
      .update({ status: "won" })
      .eq("id", leadId)
      .eq("user_id", userId);
    check(error, "Could not update lead");
  } else if (next === "rejected") {
    // A lead is only lost if it has no other quote still in play (or won).
    const { data: others, error } = await supabase
      .from("quotes")
      .select("id")
      .eq("lead_id", leadId)
      .eq("user_id", userId)
      .in("status", ["draft", "sent", "follow_up_due", "negotiating", "accepted"])
      .limit(1);
    check(error, "Could not read lead quotes");
    if (!others?.length) {
      const { error: updateError } = await supabase
        .from("leads")
        .update({ status: "lost" })
        .eq("id", leadId)
        .eq("user_id", userId);
      check(updateError, "Could not update lead");
    }
  }
}

/**
 * Side effects of a quote moving from `prev` to `next`. The caller must already
 * have written quotes.status = next.
 */
export async function applyQuoteStatusChange(
  supabase: SupabaseClient,
  userId: string,
  quote: { id: string; lead_id: string },
  prev: QuoteStatus,
  next: QuoteStatus
): Promise<void> {
  if (prev === next) return;

  if (next === "sent") {
    await scheduleFollowUps(supabase, userId, quote.id, quote.lead_id);
  }

  if (CLOSED_QUOTE_STATUSES.includes(next)) {
    // A decided/expired quote needs no more chasing.
    const { error } = await supabase
      .from("follow_ups")
      .update({ status: "skipped" })
      .eq("quote_id", quote.id)
      .eq("user_id", userId)
      .eq("status", "pending");
    check(error, "Could not close reminders");
  }

  await syncLeadForQuoteStatus(supabase, userId, quote.lead_id, next);
  await recomputeQuoteFollowUpState(supabase, userId, quote.id);
}

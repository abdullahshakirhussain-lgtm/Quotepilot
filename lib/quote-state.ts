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
import {
  deriveQuoteFollowUpState,
  nextFollowUpNumber,
  type QuoteFollowUpState,
} from "./follow-up-state";

export const CLOSED_QUOTE_STATUSES: QuoteStatus[] = ["accepted", "rejected", "expired"];

const isDate = (value?: string | null): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value ?? "");

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
): Promise<QuoteFollowUpState> {
  const { data, error } = await supabase
    .from("follow_ups")
    .select("status, due_date, completed_at")
    .eq("quote_id", quoteId)
    .eq("user_id", userId);
  check(error, "Could not read follow-ups");

  const state = deriveQuoteFollowUpState(data ?? []);
  const { error: updateError } = await supabase
    .from("quotes")
    .update(state)
    .eq("id", quoteId)
    .eq("user_id", userId);
  check(updateError, "Could not update quote");
  return state;
}

/**
 * Replaces a quote's pending reminders with a fresh schedule (the base date +
 * each configured day). Completed/skipped history is kept and numbering
 * continues after it.
 *
 * `baseDate` is the day the quote actually went out. For a quote the user sent
 * themselves days ago that puts the early reminders in the past, where they
 * belong — they show as overdue rather than being quietly pushed forward.
 * Defaults to the viewer's today.
 */
export async function scheduleFollowUps(
  supabase: SupabaseClient,
  userId: string,
  quoteId: string,
  leadId: string,
  baseDate?: string
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
  // Reminder dates count from the send date, or the user's own local day.
  const base = isDate(baseDate) ? baseDate! : await requestToday();
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

/**
 * Once the user follows up on a quote, any other reminder for it that is
 * already due is covered by that same follow-up. Those are marked skipped so
 * the quote stops showing as overdue; reminders still ahead are left alone.
 * Best effort: the follow-up itself is already recorded.
 */
export async function skipRemindersCoveredBy(
  supabase: SupabaseClient,
  userId: string,
  quoteId: string,
  completedId: string,
  today: string
): Promise<void> {
  const { error } = await supabase
    .from("follow_ups")
    .update({ status: "skipped" })
    .eq("quote_id", quoteId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .lte("due_date", today)
    .neq("id", completedId);
  if (error) console.error("[follow-ups] couldn't clear earlier due reminders:", error.message);
}

/** Keeps the lead's pipeline stage in line with its quote's outcome. */
async function syncLeadForQuoteStatus(
  supabase: SupabaseClient,
  userId: string,
  leadId: string,
  next: QuoteStatus,
  prev: QuoteStatus,
  quoteId: string
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

    // A decided quote reopened as sent puts its customer back in play — unless
    // they have another quote they already accepted.
    if (CLOSED_QUOTE_STATUSES.includes(prev)) {
      const { data: accepted, error: acceptedError } = await supabase
        .from("quotes")
        .select("id")
        .eq("lead_id", leadId)
        .eq("user_id", userId)
        .eq("status", "accepted")
        .neq("id", quoteId)
        .limit(1);
      check(acceptedError, "Could not read lead quotes");
      const { error: reopenError } = await supabase
        .from("leads")
        .update({ status: "quote_sent" })
        .eq("id", leadId)
        .eq("user_id", userId)
        .in("status", accepted?.length ? ["lost", "cold"] : ["won", "lost", "cold"]);
      check(reopenError, "Could not update lead");
    }
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
  next: QuoteStatus,
  /** The day the quote went out, when it wasn't today. */
  options?: { scheduleFrom?: string }
): Promise<void> {
  if (prev === next) return;

  if (next === "sent") {
    await scheduleFollowUps(supabase, userId, quote.id, quote.lead_id, options?.scheduleFrom);
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

  await syncLeadForQuoteStatus(supabase, userId, quote.lead_id, next, prev, quote.id);
  await recomputeQuoteFollowUpState(supabase, userId, quote.id);
}

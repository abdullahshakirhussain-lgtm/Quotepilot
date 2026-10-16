// ---------------------------------------------------------------------------
// Pure follow-up rules shared by server actions, pages, client components and
// the demo seed. "How many follow-ups were sent", "what's next", and "what's
// due today / overdue" each have exactly one definition, here.
// ---------------------------------------------------------------------------
import type { MessageType } from "./constants";
import { daysBetween } from "./utils";

/** Reminders are date-based; quote timestamps store 09:00 UTC on the due date. */
export function dueDateToTimestamp(date: string): string {
  return `${date.slice(0, 10)}T09:00:00Z`;
}

export interface FollowUpRowLite {
  status: string;
  due_date: string;
  completed_at?: string | null;
  follow_up_number?: number | null;
}

export interface QuoteFollowUpState {
  follow_up_count: number;
  last_follow_up_at: string | null;
  next_follow_up_at: string | null;
}

/**
 * The quote's follow-up counters are always derived from its reminder rows —
 * never incremented by hand — so every write path produces the same result.
 */
export function deriveQuoteFollowUpState(rows: FollowUpRowLite[]): QuoteFollowUpState {
  const completed = rows.filter((r) => r.status === "completed");
  const nextDue = rows
    .filter((r) => r.status === "pending")
    .map((r) => r.due_date.slice(0, 10))
    .sort()[0];
  const lastCompleted = completed
    .map((r) => r.completed_at)
    .filter((v): v is string => Boolean(v))
    .sort((a, b) => Date.parse(a) - Date.parse(b))
    .pop();

  return {
    follow_up_count: completed.length,
    last_follow_up_at: lastCompleted ?? null,
    next_follow_up_at: nextDue ? dueDateToTimestamp(nextDue) : null,
  };
}

/**
 * Next reminder number for a quote: one after the follow-ups actually done.
 * Skipped reminders (a quote marked won or lost, then reopened) never
 * happened, so they don't push the count up: the next one is still "#2", not
 * "#5".
 */
export function nextFollowUpNumber(rows: Pick<FollowUpRowLite, "status" | "follow_up_number">[]): number {
  return (
    rows
      .filter((r) => r.status === "completed")
      .reduce((max, r) => Math.max(max, r.follow_up_number ?? 0), 0) + 1
  );
}

export type FollowUpBucket = "overdue" | "today" | "upcoming" | "done";

/** Which Follow-ups section (and dashboard counter) a reminder belongs to. */
export function classifyFollowUp(
  row: Pick<FollowUpRowLite, "status" | "due_date">,
  today: string
): FollowUpBucket {
  if (row.status !== "pending") return "done";
  const d = row.due_date.slice(0, 10);
  if (d < today) return "overdue";
  if (d === today) return "today";
  return "upcoming";
}

/**
 * One row per quote for open reminders. A quote nobody followed up on builds
 * up several due reminders (day 1, 3, 7...), and every quote has more coming,
 * but it is one job: the lists show the earliest due reminder (matching the
 * quote's "overdue by"), or, when nothing is due, the next one coming up.
 * `dueCount` says how many are due; `laterCount` how many more are scheduled
 * after the one shown. Finished reminders pass through unchanged. Order kept.
 */
export function onePerQuote<T extends { quote_id: string; status: string; due_date: string }>(
  rows: T[],
  today: string
): Array<T & { dueCount: number; laterCount: number }> {
  const kept = new Map<string, T>();
  const due = new Map<string, number>();
  const later = new Map<string, number>();
  const day = (r: T) => r.due_date.slice(0, 10);
  for (const r of rows) {
    if (r.status !== "pending") continue;
    const isDue = day(r) <= today;
    if (isDue) due.set(r.quote_id, (due.get(r.quote_id) ?? 0) + 1);
    else later.set(r.quote_id, (later.get(r.quote_id) ?? 0) + 1);
    const best = kept.get(r.quote_id);
    // Earliest wins, so a due reminder is always chosen over an upcoming one.
    if (!best || day(r) < day(best)) kept.set(r.quote_id, r);
  }
  return rows
    .filter((r) => r.status !== "pending" || kept.get(r.quote_id) === r)
    .map((r) => {
      if (r.status !== "pending") return { ...r, dueCount: 1, laterCount: 0 };
      const upcomingShown = day(r) > today ? 1 : 0;
      return { ...r, dueCount: Math.max(due.get(r.quote_id) ?? 0, 1), laterCount: (later.get(r.quote_id) ?? 0) - upcomingShown };
    });
}

export type Urgency =
  | { level: "overdue"; days: number }
  | { level: "today"; days: 0 }
  | { level: "upcoming"; days: number }
  | { level: "none" };

/** How urgent a quote's next follow-up is (drives the quote card label). */
export function followUpUrgency(nextFollowUpAt: string | null, today: string): Urgency {
  if (!nextFollowUpAt) return { level: "none" };
  const d = daysBetween(today, nextFollowUpAt.slice(0, 10));
  if (d < 0) return { level: "overdue", days: -d };
  if (d === 0) return { level: "today", days: 0 };
  return { level: "upcoming", days: d };
}

/**
 * The message a person most likely wants for this quote right now, so the
 * assistant can draft it without asking. Users can still change it.
 */
export function suggestMessageType(
  quote: { status: string; follow_up_count: number; valid_until?: string | null },
  today: string
): MessageType {
  if (quote.status === "accepted") return "thank_you_after_acceptance";
  if (quote.status === "rejected") return "lost_lead_recovery";
  if (quote.status === "expired") return "quote_expiring";
  if (quote.valid_until && daysBetween(today, quote.valid_until.slice(0, 10)) <= 3) {
    return "quote_expiring";
  }
  if (quote.follow_up_count <= 0) return "first_follow_up";
  if (quote.follow_up_count <= 2) return "second_follow_up";
  return "final_follow_up";
}

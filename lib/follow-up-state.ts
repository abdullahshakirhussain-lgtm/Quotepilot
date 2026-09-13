// ---------------------------------------------------------------------------
// Pure follow-up rules shared by server actions, pages, client components and
// the demo seed. "How many follow-ups were sent", "what's next", and "what's
// due today / overdue" each have exactly one definition, here.
// ---------------------------------------------------------------------------

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

/** Next reminder number for a quote, continuing after any existing history. */
export function nextFollowUpNumber(rows: Pick<FollowUpRowLite, "follow_up_number">[]): number {
  return rows.reduce((max, r) => Math.max(max, r.follow_up_number ?? 0), 0) + 1;
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

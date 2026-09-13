// ---------------------------------------------------------------------------
// Dashboard metric definitions (pure, so they can be verified against the demo
// seed). Amounts are simple sums in the business currency — no FX conversion.
// ---------------------------------------------------------------------------
import { classifyFollowUp } from "./follow-up-state";

/** Leads still in play — excludes won, lost and cold. */
export const ACTIVE_LEAD_STATUSES = [
  "new",
  "contacted",
  "quote_sent",
  "follow_up_due",
  "negotiating",
] as const;

export interface DashboardMetrics {
  activeLeads: number;
  /** Quotes that have left draft (includes accepted / rejected / expired). */
  quotesSent: number;
  wonCount: number;
  lostCount: number;
  totalQuoted: number;
  acceptedValue: number;
  lostValue: number;
  /** won / (won + lost), or null until at least one quote is decided. */
  winRate: number | null;
  /** Average of quotes that have left draft. */
  avgQuote: number;
  dueToday: number;
  overdue: number;
}

function amountOf(q: { amount: number | string | null }): number {
  const n = Number(q.amount);
  return Number.isFinite(n) ? n : 0;
}

export function computeDashboardMetrics(input: {
  leads: { status: string }[];
  quotes: { status: string; amount: number | string | null }[];
  followUps: { status: string; due_date: string }[];
  today: string;
}): DashboardMetrics {
  const { leads, quotes, followUps, today } = input;

  const activeLeads = leads.filter((l) =>
    (ACTIVE_LEAD_STATUSES as readonly string[]).includes(l.status)
  ).length;

  const sent = quotes.filter((q) => q.status !== "draft");
  const won = quotes.filter((q) => q.status === "accepted");
  const lost = quotes.filter((q) => q.status === "rejected");

  const totalQuoted = sent.reduce((s, q) => s + amountOf(q), 0);
  const decided = won.length + lost.length;

  return {
    activeLeads,
    quotesSent: sent.length,
    wonCount: won.length,
    lostCount: lost.length,
    totalQuoted,
    acceptedValue: won.reduce((s, q) => s + amountOf(q), 0),
    lostValue: lost.reduce((s, q) => s + amountOf(q), 0),
    winRate: decided > 0 ? Math.round((won.length / decided) * 100) : null,
    avgQuote: sent.length > 0 ? totalQuoted / sent.length : 0,
    dueToday: followUps.filter((f) => classifyFollowUp(f, today) === "today").length,
    overdue: followUps.filter((f) => classifyFollowUp(f, today) === "overdue").length,
  };
}

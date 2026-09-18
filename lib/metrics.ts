// ---------------------------------------------------------------------------
// Dashboard metric definitions (pure, so they can be verified against the demo
// seed). Money is totalled per currency and never added across currencies:
// there is no exchange-rate conversion, so a sum of USD and EUR would be wrong.
// ---------------------------------------------------------------------------
import { classifyFollowUp } from "./follow-up-state";
import { formatCurrency } from "./utils";

/** Leads still in play — excludes won, lost and cold. */
export const ACTIVE_LEAD_STATUSES = [
  "new",
  "contacted",
  "quote_sent",
  "follow_up_due",
  "negotiating",
] as const;

/** Quotes that are out with the customer and still undecided. */
export const OPEN_QUOTE_STATUSES = ["sent", "follow_up_due", "negotiating"] as const;

/** An amount in one currency. */
export interface Money {
  currency: string;
  amount: number;
}

export interface DashboardMetrics {
  activeLeads: number;
  /** Quotes that have left draft (includes won / lost / expired). */
  quotesSent: number;
  /** Undecided quotes still with the customer, and their total value. */
  openCount: number;
  openValue: Money[];
  wonCount: number;
  lostCount: number;
  totalQuoted: Money[];
  acceptedValue: Money[];
  lostValue: Money[];
  /** won / (won + lost), or null until at least one quote is decided. */
  winRate: number | null;
  /** Average of quotes that have left draft, per currency. */
  avgQuote: Money[];
  /** Quotes that have left draft use more than one currency. */
  mixedCurrencies: boolean;
  dueToday: number;
  overdue: number;
}

type AmountRow = { amount: number | string | null; currency?: string | null };

function amountOf(q: AmountRow): number {
  const n = Number(q.amount);
  return Number.isFinite(n) ? n : 0;
}

function currencyOf(q: AmountRow, mainCurrency: string): string {
  return String(q.currency || mainCurrency).toUpperCase();
}

/**
 * Totals per currency. The business's own currency comes first, then the rest
 * by size. Empty when there are no rows.
 */
export function sumByCurrency(rows: AmountRow[], mainCurrency: string): Money[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const currency = currencyOf(row, mainCurrency);
    totals.set(currency, (totals.get(currency) ?? 0) + amountOf(row));
  }
  return sortMoney(
    Array.from(totals, ([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 })),
    mainCurrency
  );
}

function sortMoney(list: Money[], mainCurrency: string): Money[] {
  const main = mainCurrency.toUpperCase();
  return list.sort((a, b) =>
    a.currency === b.currency ? 0 : a.currency === main ? -1 : b.currency === main ? 1 : b.amount - a.amount
  );
}

/** Adds up several per-currency totals, still keeping currencies apart. */
export function combineMoney(lists: Money[][], mainCurrency: string): Money[] {
  return sumByCurrency(lists.flat(), mainCurrency);
}

/** "$1,200.00", or "$1,200.00 + €300.00" when the quotes use several currencies. */
export function formatMoney(list: Money[], fallbackCurrency: string): string {
  if (!list.length) return formatCurrency(0, fallbackCurrency);
  return list.map((m) => formatCurrency(m.amount, m.currency)).join(" + ");
}

export function computeDashboardMetrics(input: {
  leads: { status: string }[];
  quotes: { status: string; amount: number | string | null; currency?: string | null }[];
  followUps: { status: string; due_date: string }[];
  today: string;
  /** The business's currency: listed first, and used when a quote has none. */
  currency?: string;
}): DashboardMetrics {
  const { leads, quotes, followUps, today } = input;
  const main = (input.currency || "USD").toUpperCase();

  const activeLeads = leads.filter((l) =>
    (ACTIVE_LEAD_STATUSES as readonly string[]).includes(l.status)
  ).length;

  const sent = quotes.filter((q) => q.status !== "draft");
  const open = quotes.filter((q) => (OPEN_QUOTE_STATUSES as readonly string[]).includes(q.status));
  const won = quotes.filter((q) => q.status === "accepted");
  const lost = quotes.filter((q) => q.status === "rejected");

  const totalQuoted = sumByCurrency(sent, main);
  const decided = won.length + lost.length;
  const sentCount = (currency: string) => sent.filter((q) => currencyOf(q, main) === currency).length;

  return {
    activeLeads,
    quotesSent: sent.length,
    openCount: open.length,
    openValue: sumByCurrency(open, main),
    wonCount: won.length,
    lostCount: lost.length,
    totalQuoted,
    acceptedValue: sumByCurrency(won, main),
    lostValue: sumByCurrency(lost, main),
    winRate: decided > 0 ? Math.round((won.length / decided) * 100) : null,
    avgQuote: totalQuoted.map((m) => ({
      currency: m.currency,
      amount: Math.round((m.amount / sentCount(m.currency)) * 100) / 100,
    })),
    mixedCurrencies: totalQuoted.length > 1,
    dueToday: followUps.filter((f) => classifyFollowUp(f, today) === "today").length,
    overdue: followUps.filter((f) => classifyFollowUp(f, today) === "overdue").length,
  };
}

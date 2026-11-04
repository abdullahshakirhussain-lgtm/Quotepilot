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

/**
 * Which of a customer's quotes a pipeline card adds up: the won ones in Won,
 * the lost ones in Lost, and everything still in play (drafts and open quotes)
 * in the other stages. So a column total never counts an open quote as won.
 */
export function quoteCountsForStage(leadStatus: string, quoteStatus: string): boolean {
  if (leadStatus === "won") return quoteStatus === "accepted";
  if (leadStatus === "lost") return quoteStatus === "rejected";
  return quoteStatus === "draft" || (OPEN_QUOTE_STATUSES as readonly string[]).includes(quoteStatus);
}

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
  /** Quotes written but not sent yet. */
  draftCount: number;
  draftValue: Money[];
  expiredCount: number;
  expiredValue: Money[];
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

/** "$1,200.00", or "$1,200.00 and €300.00" (", " between more) when the quotes use several currencies. */
export function formatMoney(list: Money[], fallbackCurrency: string): string {
  if (!list.length) return formatCurrency(0, fallbackCurrency);
  const parts = list.map((m) => formatCurrency(m.amount, m.currency));
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * The currencies a workspace's quotes use, with how many quotes each: the
 * business's own currency first, then the rest by number of quotes.
 */
export function currencyCounts(quotes: AmountRow[], mainCurrency: string): { currency: string; count: number }[] {
  const main = mainCurrency.toUpperCase();
  const counts = new Map<string, number>();
  for (const q of quotes) {
    const c = currencyOf(q, main);
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return Array.from(counts, ([currency, count]) => ({ currency, count })).sort((a, b) =>
    a.currency === main ? -1 : b.currency === main ? 1 : b.count - a.count || a.currency.localeCompare(b.currency)
  );
}

/** Only this currency's quotes (a quote with none counts as the business's). */
export function inCurrency<T extends AmountRow>(quotes: T[], currency: string, mainCurrency: string): T[] {
  return quotes.filter((q) => currencyOf(q, mainCurrency) === currency.toUpperCase());
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
  const drafts = quotes.filter((q) => q.status === "draft");
  const expired = quotes.filter((q) => q.status === "expired");

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
    draftCount: drafts.length,
    draftValue: sumByCurrency(drafts, main),
    expiredCount: expired.length,
    expiredValue: sumByCurrency(expired, main),
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

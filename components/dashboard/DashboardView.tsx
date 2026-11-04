import Link from "next/link";
import { Plus } from "lucide-react";
import { HowItWorks } from "@/components/quotes/HowItWorks";
import { LoadSampleDataButton, SampleDataBanner } from "@/components/SampleData";
import { AttentionList } from "./AttentionList";
import { AwayUpdates } from "./AwayUpdates";
import type { AppNotification } from "@/lib/notifications";
import { QuoteLink } from "@/components/quotes/QuotePanel";
import { TypedGreeting } from "./TypedGreeting";
import { formatCurrency, relativeDay } from "@/lib/utils";
import { formatMoney, type DashboardMetrics, type Money } from "@/lib/metrics";
import type { FollowUpWithContext } from "@/lib/types";

/** How many people the dashboard lists before "See all". */
const SHOWN = 5;

/** The money bar's parts, in a fixed order with fixed colours. */
const MONEY_PARTS: { key: "open" | "won" | "lost" | "expired"; label: string; color: string }[] = [
  { key: "open", label: "Waiting", color: "#2A78D6" },
  { key: "won", label: "Won", color: "#23692A" },
  { key: "lost", label: "Lost", color: "#8A949C" },
  { key: "expired", label: "Expired", color: "#C9CED4" },
];

/** An open quote whose customer replied by email. */
export interface RepliedQuote {
  id: string;
  title: string;
  repliedAt: string;
  customerName: string;
  /** The first lines of what they wrote. */
  snippet?: string;
}

/**
 * The dashboard answers one question first: who needs following up today.
 * Under it, three numbers and one bar of where the money is. Every figure
 * appears once; the full quote list lives on the Quotes page.
 */
export function DashboardView({
  m,
  currency,
  currencies = [],
  today,
  greeting,
  firstName,
  attention,
  upcoming,
  hasData,
  hasSampleData = false,
  replied = [],
  updates = [],
  updatesTotal = 0,
}: {
  m: DashboardMetrics;
  /** The currency the overview is showing. */
  currency: string;
  /** Every currency the quotes use, with counts; a switcher appears when there are several. */
  currencies?: { currency: string; count: number }[];
  today: string;
  greeting: string;
  firstName: string;
  attention: Array<FollowUpWithContext & { dueCount?: number }>;
  upcoming: FollowUpWithContext[];
  hasData: boolean;
  /** Made-up demo customers are in the workspace. */
  hasSampleData?: boolean;
  /** Open quotes whose customer replied; their reminders are paused. */
  replied?: RepliedQuote[];
  /** Unread updates (newest few) and how many there are in all. */
  updates?: { id: string; kind: AppNotification["kind"]; quote_id: string | null; title: string; body: string | null }[];
  updatesTotal?: number;
}) {
  const hello = `${greeting}${firstName ? `, ${firstName}` : ""}`;

  // A brand-new workspace: one clear next step, not a page of zeros.
  if (!hasData) {
    return (
      <div className="flex flex-col gap-5">
        <section className="card flex flex-col gap-3 p-6 sm:p-8">
          <TypedGreeting text={hello} className="text-[17px] text-stone-600" />
          <h1 className="ql-in page-title">Welcome to QuoteLoop</h1>
          <p className="ql-in max-w-xl text-base text-stone-600" style={{ animationDelay: "60ms" }}>
            Add a quote you&apos;ve sent, or send one from here, and QuoteLoop reminds you when it&apos;s time to
            follow up.
          </p>
          <div className="ql-in mt-2 flex flex-wrap items-center gap-3" style={{ animationDelay: "120ms" }}>
            <Link href="/quotes?new=1" className="btn-primary px-5 py-2.5">
              <Plus className="h-4 w-4" strokeWidth={2.4} /> Add your first quote
            </Link>
            <LoadSampleDataButton />
          </div>
          <p className="hint">Not ready yet? Sample data is made up, so you can click around safely and remove it any time.</p>
        </section>
        <section className="card p-6">
          <HowItWorks />
        </section>
      </div>
    );
  }

  const all = replied.length + attention.length;
  const shownReplies = replied.slice(0, SHOWN);
  const shownDue = attention.slice(0, SHOWN - shownReplies.length);
  const next = upcoming[0];
  const amountIn = (list: Money[]) => list.find((x) => x.currency === currency)?.amount ?? 0;
  const parts = MONEY_PARTS.map((p) => ({
    ...p,
    amount: amountIn(p.key === "open" ? m.openValue : p.key === "won" ? m.acceptedValue : p.key === "lost" ? m.lostValue : m.expiredValue),
  }))
    // Expired only appears once there is some.
    .filter((p) => p.key !== "expired" || p.amount > 0);
  const moneyTotal = parts.reduce((n, p) => n + p.amount, 0);

  return (
    <div className="flex flex-col gap-4">
      <AwayUpdates items={updates} total={updatesTotal} />
      {hasSampleData && <SampleDataBanner />}

      {/* Who needs you today: the headline is the count, the list is the people. */}
      <section aria-labelledby="follow-up-now" className="flex flex-col gap-3">
        <h1 id="follow-up-now" className="text-[22px] font-medium leading-tight text-stone-900">
          {all > 0 ? (
            <>
              <span className="num">{all}</span> {all === 1 ? "quote needs" : "quotes need"} you today
            </>
          ) : (
            "You’re all caught up"
          )}
        </h1>
        <div className="card">
          {shownReplies.length > 0 && (
            <ul className="flex flex-col divide-y divide-[#ECEEF1]" aria-label="Customers who replied">
              {shownReplies.map((r) => (
                <li key={r.id} className="flex items-center gap-3 bg-info-50/60 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-stone-900 [overflow-wrap:anywhere]">{r.customerName}</div>
                    <div className="text-[13px] text-stone-500 [overflow-wrap:anywhere]">
                      Replied {relativeDay(r.repliedAt, today)} about {r.title}
                    </div>
                    {r.snippet && (
                      <div className="mt-0.5 line-clamp-1 text-[14px] text-stone-700 [overflow-wrap:anywhere]">&ldquo;{r.snippet}&rdquo;</div>
                    )}
                  </div>
                  <QuoteLink quoteId={r.id} className="btn-secondary shrink-0 px-3" aria-label={`Answer ${r.customerName}'s reply`}>
                    Answer
                  </QuoteLink>
                </li>
              ))}
            </ul>
          )}
          {shownDue.length > 0 && (
            <div className={shownReplies.length > 0 ? "border-t border-[#ECEEF1]" : undefined}>
              <AttentionList items={shownDue} today={today} />
            </div>
          )}
          {all === 0 && (
            <p className="px-5 py-4 text-[15px] text-stone-600">
              {next ? (
                <>
                  Next: <span className="font-medium text-stone-900">{next.lead?.customer_name ?? "a customer"}</span>,{" "}
                  {relativeDay(next.due_date, today)}
                </>
              ) : (
                "Nothing is waiting on you."
              )}
            </p>
          )}
          {all > SHOWN && (
            <Link
              href="/follow-ups"
              className="tap flex items-center border-t border-[#ECEEF1] px-5 text-[14px] font-medium text-stone-700 hover:text-stone-900 hover:underline"
            >
              See all {all}
            </Link>
          )}
        </div>
      </section>

      {/* Three numbers. Amounts are in one currency at a time, never added across currencies. */}
      <section aria-label="Your numbers" className="flex flex-col gap-2">
        {currencies.length > 1 && (
          <nav aria-label="Currency" className="flex flex-wrap items-center justify-end gap-1.5">
            {currencies.map((c) => (
              // A plain link (a fresh page): same-page navigation can stall on the dashboard (Next 15.5).
              <a
                key={c.currency}
                href={`/dashboard?currency=${c.currency}`}
                aria-current={c.currency === currency ? "true" : undefined}
                className={`tap inline-flex items-center gap-1.5 rounded-full px-3 text-[13px] font-medium ${
                  c.currency === currency ? "bg-stone-900 text-white" : "border border-line bg-white text-stone-700 hover:border-stone-400"
                }`}
              >
                {c.currency}
                <span className={`num ${c.currency === currency ? "text-stone-300" : "text-stone-500"}`}>{c.count}</span>
              </a>
            ))}
          </nav>
        )}
        <dl className="card grid grid-cols-1 divide-y divide-[#ECEEF1] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Figure label="Waiting" value={formatMoney(m.openValue, currency)} />
          <Figure label="Won" value={formatMoney(m.acceptedValue, currency)} />
          <Figure
            label="Win rate"
            value={m.winRate === null ? "–" : `${m.winRate}%`}
            note={m.winRate === null ? "Nothing won or lost yet" : undefined}
          />
        </dl>
      </section>

      {/* One picture: where the money in sent quotes stands. */}
      <section className="card px-5 py-4" aria-labelledby="money-title">
        <h2 id="money-title" className="text-[16px] font-medium text-stone-900">
          Where your money is
        </h2>
        {moneyTotal > 0 ? (
          <>
            <div
              className="mt-3 flex h-7 gap-[3px] overflow-hidden rounded-[6px]"
              role="img"
              aria-label={parts.map((p) => `${p.label} ${formatCurrency(p.amount, currency)}`).join(", ")}
            >
              {parts
                .filter((p) => p.amount > 0)
                .map((p) => (
                  <span key={p.key} className="block h-full min-w-[6px]" style={{ flexGrow: p.amount, flexBasis: 0, background: p.color }} />
                ))}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[14px] text-stone-600">
              {parts.map((p) => (
                <li key={p.key} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: p.color }} aria-hidden="true" />
                  {p.label} <span className="num font-medium text-stone-900">{formatCurrency(p.amount, currency)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <div className="mt-3 h-7 rounded-[6px] bg-stone-100" aria-hidden="true" />
            <p className="mt-3 text-[14px] text-stone-500">Fills in once you&apos;ve sent a quote.</p>
          </>
        )}
      </section>
    </div>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 px-5 py-3.5 sm:block">
      <dt className="text-[14px] text-stone-500">{label}</dt>
      {/* Long amounts get a smaller size, so a big total stays on one line instead of breaking mid-number. */}
      <dd
        className={`num text-right font-medium leading-tight text-stone-900 [overflow-wrap:anywhere] sm:mt-1 sm:text-left ${
          value.length > 16 ? "text-[17px]" : value.length > 12 ? "text-[20px]" : "text-[24px]"
        }`}
      >
        {value}
        {note && <span className="block text-[13px] font-normal text-stone-500">{note}</span>}
      </dd>
    </div>
  );
}

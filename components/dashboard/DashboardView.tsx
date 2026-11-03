import Link from "next/link";
import { Plus, UserPlus } from "lucide-react";
import { HowItWorks } from "@/components/quotes/HowItWorks";
import { LoadSampleDataButton, SampleBadge, SampleDataBanner } from "@/components/SampleData";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AttentionList } from "./AttentionList";
import { TypedGreeting } from "./TypedGreeting";
import { formatCurrency, formatDate, relativeDay } from "@/lib/utils";
import { formatMoney, type DashboardMetrics, type Money } from "@/lib/metrics";
import type { QuoteStatus } from "@/lib/constants";
import type { FollowUpWithContext } from "@/lib/types";

/** One row of the "Latest quotes" list. */
export interface LatestQuote {
  id: string;
  title: string;
  amount: number;
  currency: string;
  status: QuoteStatus;
  quoteDate: string;
  customerName: string;
  companyName: string | null;
  sample: boolean;
}

/** Quote statuses in the overview ring, in a fixed order with fixed colours. */
const RING: { key: string; label: string; color: string; money: string }[] = [
  { key: "open", label: "Open", color: "#2A78D6", money: "text-stone-900" },
  { key: "draft", label: "Not sent", color: "#EDA100", money: "text-stone-900" },
  { key: "won", label: "Won", color: "#23692A", money: "text-emerald-700" },
  { key: "lost", label: "Lost", color: "#8A949C", money: "text-stone-500" },
  { key: "expired", label: "Expired", color: "#C9CED4", money: "text-stone-500" },
];

/**
 * The dashboard, laid out like the owner's reference: an overview card (quotes
 * by status, and the totals), what to follow up now, and the newest quotes.
 * Every figure appears once. Data is loaded by the page.
 */
export function DashboardView({
  m,
  currency,
  today,
  greeting,
  firstName,
  attention,
  upcoming,
  hasData,
  hasSampleData = false,
  customers,
  latest,
}: {
  m: DashboardMetrics;
  currency: string;
  today: string;
  greeting: string;
  firstName: string;
  attention: Array<FollowUpWithContext & { dueCount?: number }>;
  upcoming: FollowUpWithContext[];
  hasData: boolean;
  /** Made-up demo customers are in the workspace. */
  hasSampleData?: boolean;
  /** Every customer in the workspace. */
  customers: number;
  latest: LatestQuote[];
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

  const counts: Record<string, number> = {
    open: m.openCount,
    draft: m.draftCount,
    won: m.wonCount,
    lost: m.lostCount,
    expired: m.expiredCount,
  };
  const money: Record<string, Money[]> = {
    open: m.openValue,
    draft: m.draftValue,
    won: m.acceptedValue,
    lost: m.lostValue,
    expired: m.expiredValue,
  };
  // Expired only appears once there is one.
  const ring = RING.filter((r) => r.key !== "expired" || counts.expired > 0);
  const total = ring.reduce((n, r) => n + counts[r.key], 0);
  const next = upcoming[0];

  return (
    <div className="flex flex-col gap-4">
      {hasSampleData && <SampleDataBanner />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[20px] font-medium text-stone-900">
          <TypedGreeting text={hello} />
        </h1>
        <Link href="/leads?new=1" className="btn bg-stone-600 text-white hover:bg-stone-700">
          <UserPlus className="h-4 w-4" /> Add customer
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Overview: quotes by status, then the totals */}
        <section className="card ql-in" aria-labelledby="overview">
          <div className="card-head">
            <h2 id="overview" className="card-title">Overview</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 p-5 2xl:grid-cols-[auto_minmax(0,1fr)] 2xl:items-center">
            <div className="flex min-w-0 flex-wrap items-center gap-6 2xl:border-r 2xl:border-[#ECEEF1] 2xl:pr-6">
              <StatusRing segments={ring.map((r) => ({ ...r, value: counts[r.key] }))} total={total} />
              <dl className="grid min-w-0 max-w-full grid-cols-[auto_auto_minmax(0,auto)] items-center gap-x-4 gap-y-2.5 text-[14px]">
                {ring.map((r) => (
                  <div key={r.key} className="contents">
                    <dt className="flex items-center gap-2 text-stone-700">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden="true" />
                      {r.label}
                    </dt>
                    <dd className="num text-right text-stone-500">{counts[r.key]}</dd>
                    <dd className={`num text-right font-medium [overflow-wrap:anywhere] ${r.money}`}>{formatMoney(money[r.key], currency)}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <dl className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(9.5rem,100%),1fr))] gap-x-5 gap-y-4 border-t border-[#ECEEF1] pt-5 2xl:border-t-0 2xl:pt-0">
              <Figure label="Quoted in total" value={formatMoney(m.totalQuoted, currency)} />
              <div className="min-w-0">
                <dt className="text-[13px] text-stone-500">Win rate</dt>
                <dd className="flex items-center gap-2.5">
                  {m.winRate === null ? (
                    <span className="text-[14px] text-stone-500">Nothing won or lost yet</span>
                  ) : (
                    <>
                      <span className="num text-[24px] font-medium leading-tight">{m.winRate}%</span>
                      <span
                        className="h-1.5 max-w-24 flex-1 overflow-hidden rounded-full bg-stone-200"
                        role="img"
                        aria-label={`${m.wonCount} won, ${m.lostCount} lost`}
                      >
                        <span className="block h-full bg-emerald-600" style={{ width: `${m.winRate}%` }} />
                      </span>
                    </>
                  )}
                </dd>
              </div>
              <Figure label="Average quote" value={formatMoney(m.avgQuote, currency)} />
              <Figure label="Customers" value={String(customers)} />
            </dl>
          </div>
          {m.mixedCurrencies && (
            <p className="border-t border-[#ECEEF1] px-5 py-3 text-[13px] text-stone-500">
              Your quotes use more than one currency, so each currency is totalled separately.
            </p>
          )}
        </section>

        {/* What to do now */}
        {/* First on phones and tablets, beside the overview on wide screens. */}
        <section className="card ql-in order-first flex flex-col xl:order-none" style={{ animationDelay: "60ms" }} aria-labelledby="follow-up-now">
          <div className="card-head">
            <h2 id="follow-up-now" className="card-title">Follow up now</h2>
            {attention.length > 0 && (
              <span className="num rounded-full bg-red-500 px-2.5 text-[13px] font-medium leading-6 text-white">{attention.length}</span>
            )}
          </div>
          {attention.length ? (
            <AttentionList items={attention} today={today} />
          ) : (
            <p className="px-5 py-5 text-[14px] text-stone-500">You&apos;re all caught up. Nothing is due right now.</p>
          )}
          {next && (
            <p className="mt-auto border-t border-[#ECEEF1] px-5 py-3 text-[13px] text-stone-500">
              Next: {next.lead?.customer_name ?? "a customer"}, {relativeDay(next.due_date, today)}
            </p>
          )}
        </section>
      </div>

      {/* The newest quotes, in the space a chart would take */}
      <section className="card ql-in" style={{ animationDelay: "120ms" }} aria-labelledby="latest">
        <div className="card-head">
          <h2 id="latest" className="card-title">Latest quotes</h2>
          <Link href="/quotes?tab=all" className="tap inline-flex items-center text-[14px] font-medium text-info-700 hover:underline">
            See all quotes
          </Link>
        </div>
        {latest.length ? (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] text-[14px]">
              <thead>
                <tr className="text-left text-[13px] text-stone-500">
                  <th className="px-5 py-2.5 font-medium">Customer</th>
                  <th className="px-5 py-2.5 font-medium">Job</th>
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {latest.map((q) => (
                  <tr key={q.id} className="border-t border-[#ECEEF1] transition-colors hover:bg-stone-50">
                    <td className="px-5 py-3 align-middle">
                      <div className="flex flex-wrap items-baseline gap-x-2 font-medium text-stone-900 [overflow-wrap:anywhere]">
                        {q.customerName}
                        {q.sample && <SampleBadge />}
                      </div>
                      {q.companyName && <div className="text-[12px] text-stone-500 [overflow-wrap:anywhere]">{q.companyName}</div>}
                    </td>
                    <td className="px-5 py-3 align-middle text-stone-700 [overflow-wrap:anywhere]">{q.title}</td>
                    <td className="num whitespace-nowrap px-5 py-3 align-middle text-stone-500">{formatDate(q.quoteDate)}</td>
                    <td className="px-5 py-3 align-middle">
                      <StatusBadge kind="quote" value={q.status} />
                    </td>
                    <td className="num whitespace-nowrap px-5 py-3 text-right align-middle font-medium text-stone-900">
                      {formatCurrency(q.amount, q.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-5 text-[14px] text-stone-500">No quotes yet.</p>
        )}
      </section>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-stone-500">{label}</dt>
      <dd className="num text-[24px] font-medium leading-tight text-stone-900 [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}

/** Quotes by status as a ring, with the total in the middle. */
function StatusRing({
  segments,
  total,
}: {
  segments: { key: string; label: string; color: string; value: number }[];
  total: number;
}) {
  const r = 60;
  const c = 2 * Math.PI * r;
  const shown = segments.filter((s) => s.value > 0);
  // A small gap of page colour between segments, when there's more than one.
  const gap = shown.length > 1 ? 3 : 0;
  let start = 0;
  return (
    <svg
      viewBox="0 0 160 160"
      className="h-[132px] w-[132px] shrink-0"
      role="img"
      aria-label={`${total} quotes: ${segments.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(", ")}`}
    >
      <g transform="rotate(-90 80 80)" fill="none" strokeWidth="16">
        {total === 0 ? (
          <circle cx="80" cy="80" r={r} stroke="#E4E7EB" />
        ) : (
          shown.map((s) => {
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={s.key}
                cx="80"
                cy="80"
                r={r}
                stroke={s.color}
                strokeDasharray={`${Math.max(len - gap, 0.5)} ${c}`}
                strokeDashoffset={-start}
              >
                <title>{`${s.label}: ${s.value}`}</title>
              </circle>
            );
            start += len;
            return el;
          })
        )}
      </g>
      <text x="80" y="80" textAnchor="middle" fontSize="30" fontWeight="500" fill="#1F2328">
        {total}
      </text>
      <text x="80" y="102" textAnchor="middle" fontSize="13" fill="#5F6872">
        {total === 1 ? "quote" : "quotes"}
      </text>
    </svg>
  );
}

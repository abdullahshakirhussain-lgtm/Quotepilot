import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { LoadSampleDataButton, SampleDataBanner } from "@/components/SampleData";
import { AttentionList } from "./AttentionList";
import { QuoteLink } from "@/components/quotes/QuotePanel";
import { TypedGreeting } from "./TypedGreeting";
import { cn, dateInZone, formatCurrency, relativeDay } from "@/lib/utils";
import { formatMoney, type DashboardMetrics } from "@/lib/metrics";
import type { RecentItem, WeekProgress, Wins } from "@/lib/dashboard-extras";
import type { FollowUpWithContext } from "@/lib/types";

/** How many people the dashboard lists before "See all". */
const SHOWN = 5;

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
 * The dashboard, in the order the research behind it puts things: what needs
 * doing today first, then progress you can see filling up, then the money in
 * context, then what happened lately. A new account sees a short checklist to
 * its first follow-up instead of a page of zeros.
 */
export function DashboardView({
  m,
  currency,
  currencies = [],
  today,
  timeZone = "UTC",
  greeting,
  firstName,
  attention,
  upcoming,
  hasData,
  hasSampleData = false,
  replied = [],
  week = null,
  followedUpOnce = true,
  wins = null,
  recent = [],
}: {
  m: DashboardMetrics;
  /** The currency the overview is showing. */
  currency: string;
  /** Every currency the quotes use, with counts; a switcher appears when there are several. */
  currencies?: { currency: string; count: number }[];
  today: string;
  timeZone?: string;
  greeting: string;
  firstName: string;
  attention: Array<FollowUpWithContext & { dueCount?: number }>;
  upcoming: FollowUpWithContext[];
  hasData: boolean;
  /** Made-up demo customers are in the workspace. */
  hasSampleData?: boolean;
  /** Open quotes whose customer replied; their reminders are paused. */
  replied?: RepliedQuote[];
  week?: WeekProgress | null;
  /** At least one follow-up was ever done. */
  followedUpOnce?: boolean;
  /** Won this month and last, in the currency shown; null until the dates are recorded. */
  wins?: Wins | null;
  recent?: RecentItem[];
}) {
  const hello = `${greeting}${firstName ? `, ${firstName}` : ""}`;
  const steps = [
    { label: "Set up your business", done: true },
    { label: "Add a quote you sent", done: m.quotesSent + m.draftCount > 0 },
    { label: "Send your first follow-up", done: followedUpOnce },
    { label: "Mark a quote won or lost", done: m.wonCount + m.lostCount > 0 },
  ];

  // A brand-new workspace: the way to a first follow-up, not a page of zeros.
  if (!hasData) {
    return (
      <div className="flex flex-col gap-4">
        <section className="card flex flex-col gap-3 p-6 sm:p-8" aria-labelledby="welcome">
          <TypedGreeting text={hello} className="text-[17px] text-stone-600" />
          <h1 id="welcome" className="page-title">
            Welcome to QuoteLoop
          </h1>
          <p className="max-w-xl text-base text-stone-600">
            Four steps to your first quote followed up. Nothing is sent until you choose to.
          </p>
          <Checklist steps={steps} />
          <div className="flex flex-wrap items-center gap-3 border-t border-[#ECEEF1] pt-4">
            <LoadSampleDataButton />
            <p className="hint">Sample data is made up, so you can click around safely and remove it any time.</p>
          </div>
        </section>
      </div>
    );
  }

  const all = replied.length + attention.length;
  const shownReplies = replied.slice(0, SHOWN);
  const shownDue = attention.slice(0, SHOWN - shownReplies.length);
  const next = upcoming[0];
  const when = (iso: string) => {
    const s = relativeDay(dateInZone(iso, timeZone), today);
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  return (
    <div className="flex flex-col gap-4">
      {hasSampleData && <SampleDataBanner />}

      {/* Until the first follow-up is done: the steps there, at the top. */}
      {!followedUpOnce && (
        <section className="card px-5 py-4" aria-labelledby="get-started">
          <h2 id="get-started" className="text-[16px] font-medium text-stone-900">
            Get your first quote followed up
          </h2>
          <Checklist steps={steps} />
        </section>
      )}

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

      {/* Progress you can see filling up: this week's follow-ups, Monday to Sunday. */}
      {week && (
        <section className="card px-5 py-4" aria-labelledby="this-week">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="this-week" className="text-[16px] font-medium text-stone-900">
              This week
            </h2>
            <p className="num text-[14px] text-stone-600">
              {week.total === 0
                ? "No follow-ups due this week"
                : week.done === week.total
                  ? `All ${week.total} follow-ups done`
                  : `${week.done} of ${week.total} follow-ups done`}
            </p>
          </div>
          {week.total > 0 && (
            <div
              className="mt-3 h-2.5 overflow-hidden rounded-full bg-stone-100"
              role="img"
              aria-label={`${week.done} of ${week.total} follow-ups due this week are done`}
            >
              <div className="h-full rounded-full bg-emerald-600 transition-[width] duration-300" style={{ width: `${Math.round((week.done / week.total) * 100)}%` }} />
            </div>
          )}
        </section>
      )}

      {/* The money, in context. Amounts are in one currency at a time, never added across currencies. */}
      <section aria-label="Your numbers" className="flex flex-col gap-2">
        {currencies.length > 1 && (
          <nav aria-label="Currency" className="flex flex-wrap items-center justify-end gap-1.5">
            {currencies.map((c) => (
              // A plain link (a fresh page): same-page navigation can stall on the dashboard (Next 15.5).
              <a
                key={c.currency}
                href={`/dashboard?currency=${c.currency}`}
                aria-current={c.currency === currency ? "true" : undefined}
                className={cn(
                  "tap inline-flex items-center gap-1.5 rounded-full px-3 text-[13px] font-medium",
                  c.currency === currency ? "border border-stone-300 bg-stone-200/80 text-stone-900" : "border border-line bg-white text-stone-700 hover:border-stone-400"
                )}
              >
                {c.currency}
                <span className="num text-stone-500">{c.count}</span>
              </a>
            ))}
          </nav>
        )}
        <dl className="card grid grid-cols-1 divide-y divide-[#ECEEF1] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <Figure label="Open quotes" value={formatMoney(m.openValue, currency)} note={`${m.openCount} ${m.openCount === 1 ? "quote" : "quotes"} waiting on a reply`} />
          <Figure
            label="Won this month"
            value={wins ? formatCurrency(wins.thisMonth, currency) : "–"}
            note={wins ? `Last month ${formatCurrency(wins.lastMonth, currency)}` : "Counting from today"}
          />
        </dl>
      </section>

      {/* What happened lately, so nothing done in the background goes unseen. */}
      {recent.length > 0 && (
        <section className="card" aria-labelledby="recent">
          <h2 id="recent" className="border-b border-[#ECEEF1] px-5 py-3 text-[16px] font-medium text-stone-900">
            Recent
          </h2>
          <ul className="divide-y divide-[#ECEEF1]">
            {recent.map((r, i) => (
              <li key={`${r.at}-${i}`} className="flex items-baseline gap-3 px-5 py-3 text-[15px]">
                {r.unread && (
                  <span className="h-2 w-2 shrink-0 self-center rounded-full bg-info-500" aria-hidden="true" />
                )}
                <span className={cn("min-w-0 flex-1 [overflow-wrap:anywhere]", r.unread ? "font-medium text-stone-900" : "text-stone-700")}>
                  {r.unread && <span className="sr-only">New: </span>}
                  {r.text}
                </span>
                <span className="shrink-0 text-[13px] text-stone-500">{when(r.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** The steps to a first follow-up, with progress filled in as each is done. */
function Checklist({ steps }: { steps: { label: string; done: boolean }[] }) {
  const done = steps.filter((s) => s.done).length;
  const nextStep = steps.findIndex((s) => !s.done);
  return (
    <div className="mt-3">
      <div className="flex gap-1.5" role="img" aria-label={`${done} of ${steps.length} steps done`}>
        {steps.map((s) => (
          <span key={s.label} className={cn("h-2 flex-1 rounded-full", s.done ? "bg-emerald-600" : "bg-stone-200")} />
        ))}
      </div>
      <p className="num mt-1.5 text-[13px] text-stone-500">
        {done} of {steps.length} done
      </p>
      <ol className="mt-2 divide-y divide-[#ECEEF1]">
        {steps.map((s, i) => (
          <li key={s.label} className="flex min-h-11 items-center gap-3 py-2">
            <span
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full border",
                s.done ? "border-emerald-600 bg-emerald-600 text-white" : "border-stone-300 text-transparent"
              )}
              aria-hidden="true"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <span className={cn("min-w-0 flex-1 text-[15px]", s.done ? "text-stone-500" : i === nextStep ? "font-medium text-stone-900" : "text-stone-600")}>
              <span className="sr-only">{s.done ? "Done: " : "To do: "}</span>
              {s.label}
            </span>
            {i === nextStep && i === 1 && (
              <Link href="/quotes?new=1" className="btn-secondary shrink-0 px-3">
                <Plus className="h-4 w-4" /> Add your first quote
              </Link>
            )}
            {i === nextStep && i === 2 && (
              <Link href="/follow-ups" className="btn-secondary shrink-0 px-3">
                Go to follow-ups
              </Link>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0 px-5 py-3.5">
      <dt className="text-[14px] text-stone-500">{label}</dt>
      {/* Long amounts get a smaller size, so a big total stays on one line instead of breaking mid-number. */}
      <dd
        className={cn(
          "num mt-1 font-medium leading-tight text-stone-900 [overflow-wrap:anywhere]",
          value.length > 16 ? "text-[17px]" : value.length > 12 ? "text-[20px]" : "text-[24px]"
        )}
      >
        {value}
      </dd>
      {note && <dd className="mt-0.5 text-[13px] text-stone-500">{note}</dd>}
    </div>
  );
}

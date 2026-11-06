import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { LoadSampleDataButton, SampleDataBanner } from "@/components/SampleData";
import { AttentionList } from "./AttentionList";
import { QuoteLink } from "@/components/quotes/QuotePanel";
import { TypedGreeting } from "./TypedGreeting";
import { cn, dateInZone, formatCurrency, relativeDay } from "@/lib/utils";
import { formatMoney, type AgeBucket, type DashboardMetrics } from "@/lib/metrics";
import type { RecentItem, WeekCount, Wins } from "@/lib/dashboard-extras";
import { OpenByAge } from "./OpenByAge";
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
  weeks = null,
  ages = [],
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
  /** Follow-ups done each week, the last eight, this week last. */
  weeks?: WeekCount[] | null;
  /** Open quotes by how long they've waited, in the currency shown. */
  ages?: AgeBucket[];
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
            Three steps to your first quote followed up. Nothing is sent until you choose to.
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
  const when = (iso: string) => {
    const s = relativeDay(dateInZone(iso, timeZone), today);
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  // What makes up the headline, in the words the rest of the app uses (the
  // Follow-ups badge counts the same follow-ups).
  const parts = [
    replied.length ? `${replied.length} ${replied.length === 1 ? "customer" : "customers"} replied` : "",
    attention.length ? `${attention.length} ${attention.length === 1 ? "follow-up" : "follow-ups"} due` : "",
  ].filter(Boolean);
  // Recent leaves out replies already listed above.
  const listedReplies = new Set(shownReplies.map((r) => r.id));
  const recentShown = recent.filter((r) => !(r.reply && r.quoteId && listedReplies.has(r.quoteId))).slice(0, 5);
  const thisWeek = weeks?.[weeks.length - 1]?.count ?? 0;
  const noWins = wins && wins.thisMonth === 0 && wins.lastMonth === 0;

  return (
    <div className="flex flex-col gap-4">
      {hasSampleData && <SampleDataBanner />}

      {/* Wide screens: today's people on the left, progress, money and activity
          beside them, so a short list isn't stretched across the whole screen.
          Narrower screens keep one column in the same order. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start">
        <div className="flex min-w-0 flex-col gap-4">
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
            <div>
              <h1 id="follow-up-now" className="text-[24px] font-semibold leading-tight text-stone-900">
                {all > 0 ? (
                  <>
                    <span className="num">{all}</span> {all === 1 ? "quote needs" : "quotes need"} you today
                  </>
                ) : (
                  "You’re all caught up"
                )}
              </h1>
              <p className="mt-1 text-[15px] text-stone-600">
                {all > 0 ? parts.join(" and ") : "Every open quote has been followed up. Here’s what’s coming next."}
              </p>
            </div>

            {all > 0 ? (
              <div className="card border-stone-300 shadow-[0_1px_2px_rgba(31,35,40,0.06)]">
                {shownReplies.length > 0 && (
                  <ul className="flex flex-col divide-y divide-[#ECEEF1]" aria-label="Customers who replied">
                    {shownReplies.map((r) => (
                      <li key={r.id} className="flex items-center gap-3 bg-info-50/60 px-5 py-3.5">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-stone-900 [overflow-wrap:anywhere]">{r.customerName}</div>
                          <div className="text-[13px] text-stone-600 [overflow-wrap:anywhere]">
                            {r.title}, replied {relativeDay(r.repliedAt, today)}
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
                {all > SHOWN && (
                  <Link
                    href="/follow-ups"
                    className="tap flex items-center border-t border-[#ECEEF1] px-5 text-[14px] font-medium text-stone-700 hover:text-stone-900 hover:underline"
                  >
                    See all {all}
                  </Link>
                )}
              </div>
            ) : (
              // Caught up: say so plainly, then what's coming, so the screen still says what's next.
              <div className="card border-stone-300">
                <div className="flex items-center gap-3 border-b border-[#ECEEF1] px-5 py-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-600 text-white" aria-hidden="true">
                    <Check className="h-5 w-5" strokeWidth={3} />
                  </span>
                  <p className="text-[15px] text-stone-700">
                    {thisWeek > 0 ? (
                      <>
                        You did <span className="num font-medium text-stone-900">{thisWeek}</span> {thisWeek === 1 ? "follow-up" : "follow-ups"} this week.
                      </>
                    ) : (
                      "Nothing is waiting on you."
                    )}
                  </p>
                </div>
                {upcoming.length > 0 ? (
                  <>
                    <h2 className="px-5 pt-3 text-[14px] font-medium text-stone-500">Coming up</h2>
                    <ul className="divide-y divide-[#ECEEF1]">
                      {upcoming.slice(0, 3).map((f) => (
                        <li key={f.id}>
                          {f.quote ? (
                            <QuoteLink quoteId={f.quote.id} className="flex items-center gap-3 px-5 py-3 hover:bg-stone-50 focus-visible:bg-stone-50">
                              <UpcomingRow f={f} today={today} />
                            </QuoteLink>
                          ) : (
                            <div className="flex items-center gap-3 px-5 py-3">
                              <UpcomingRow f={f} today={today} />
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="px-5 py-4 text-[15px] text-stone-600">
                    No follow-ups are scheduled. Add a quote you&apos;ve sent and QuoteLoop plans its follow-ups.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {/* Which currency the amounts are in: one at a time, never added across currencies. */}
          {currencies.length > 1 && (
            <nav aria-label="Currency shown" className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[13px] text-stone-500">Amounts in</span>
              {currencies.map((c) => (
                // A plain link (a fresh page): same-page navigation can stall on the dashboard (Next 15.5).
                <a
                  key={c.currency}
                  href={`/dashboard?currency=${c.currency}`}
                  aria-current={c.currency === currency ? "true" : undefined}
                  className={cn(
                    "tap inline-flex items-center rounded-full px-3 text-[13px] font-medium",
                    c.currency === currency ? "bg-stone-900 text-white" : "border border-line bg-white text-stone-700 hover:border-stone-400"
                  )}
                >
                  {c.currency}
                </a>
              ))}
            </nav>
          )}

          {/* The money waiting, by how long it has waited: what's going cold is what to chase. */}
          <section className="card px-5 py-4" aria-labelledby="open-quotes">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id="open-quotes" className="text-[16px] font-medium text-stone-900">
                Open quotes
              </h2>
              <p className="num text-[22px] font-semibold leading-tight text-stone-900">{formatMoney(m.openValue, currency)}</p>
            </div>
            <p className="text-[13px] text-stone-500">
              {m.openCount === 0
                ? "No quotes waiting on a reply."
                : `${m.openCount} ${m.openCount === 1 ? "quote" : "quotes"} waiting, by days since sent`}
            </p>
            {m.openCount > 0 && ages.length > 0 && <OpenByAge ages={ages} currency={currency} />}
          </section>

          {/* Wins, in the same currency. */}
          <section className="card px-5 py-3.5" aria-labelledby="won">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id="won" className="text-[16px] font-medium text-stone-900">
                Won this month
              </h2>
              {noWins || !wins ? (
                <p className="text-[15px] font-medium text-stone-500">No wins yet</p>
              ) : (
                <p className="num text-[22px] font-semibold leading-tight text-emerald-700">{formatCurrency(wins.thisMonth, currency)}</p>
              )}
            </div>
            <p className="text-[13px] text-stone-500">
              {!wins
                ? "Counting from today"
                : noWins
                  ? "Mark a quote won and it adds up here"
                  : `Last month ${formatCurrency(wins.lastMonth, currency)}`}
            </p>
          </section>

          {/* What happened lately, so nothing done in the background goes unseen. */}
          {recentShown.length > 0 && (
            <section className="card" aria-labelledby="recent">
              <h2 id="recent" className="border-b border-[#ECEEF1] px-5 py-3 text-[16px] font-medium text-stone-900">
                Recent
              </h2>
              <ul className="divide-y divide-[#ECEEF1]">
                {recentShown.map((r, i) => {
                  const row = "flex items-baseline gap-3 px-5 py-3 text-[15px]";
                  const inner = (
                    <>
                      {r.unread && (
                        <span className="h-2 w-2 shrink-0 self-center rounded-full bg-info-500" aria-hidden="true" />
                      )}
                      <span className={cn("min-w-0 flex-1 [overflow-wrap:anywhere]", r.unread ? "font-medium text-stone-900" : "text-stone-700")}>
                        {r.unread && <span className="sr-only">New: </span>}
                        {r.text}
                      </span>
                      <span className="shrink-0 text-[13px] text-stone-500">{when(r.at)}</span>
                    </>
                  );
                  // Each line opens what it's about: the quote, or billing.
                  const link = cn(row, "hover:bg-stone-50 focus-visible:bg-stone-50");
                  return (
                    <li key={`${r.at}-${i}`}>
                      {r.quoteId ? (
                        <QuoteLink quoteId={r.quoteId} className={link}>
                          {inner}
                        </QuoteLink>
                      ) : r.href ? (
                        // A plain link (a fresh page): same-page navigation can stall on the dashboard (Next 15.5).
                        <a href={r.href} className={link}>
                          {inner}
                        </a>
                      ) : (
                        <div className={row}>{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/** One coming follow-up: who, which quote, and when. */
function UpcomingRow({ f, today }: { f: FollowUpWithContext; today: string }) {
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-stone-900 [overflow-wrap:anywhere]">{f.lead?.customer_name ?? "Customer"}</span>
        {f.quote?.title && <span className="block text-[13px] text-stone-600 [overflow-wrap:anywhere]">{f.quote.title}</span>}
      </span>
      <span className="shrink-0 rounded-full bg-info-50 px-2.5 py-0.5 text-[13px] font-medium text-info-700">
        {(() => {
          const s = relativeDay(f.due_date, today);
          return s.charAt(0).toUpperCase() + s.slice(1);
        })()}
      </span>
    </>
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

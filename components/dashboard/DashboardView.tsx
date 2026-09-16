import Link from "next/link";
import { ArrowRight, BellRing, CalendarCheck, Plus } from "lucide-react";
import { HowItWorks } from "@/components/quotes/HowItWorks";
import { EmptyState } from "@/components/ui/EmptyState";
import { AttentionList } from "./AttentionList";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { DashboardMetrics } from "@/lib/metrics";
import type { FollowUpWithContext } from "@/lib/types";

/** The dashboard's presentation. Data is loaded by the page. */
export function DashboardView({
  m,
  currency,
  today,
  greeting,
  firstName,
  attention,
  upcoming,
  hasData,
}: {
  m: DashboardMetrics;
  currency: string;
  today: string;
  greeting: string;
  firstName: string;
  attention: FollowUpWithContext[];
  upcoming: FollowUpWithContext[];
  hasData: boolean;
}) {
  const needAttention = m.dueToday + m.overdue;

  return (
    <div className="space-y-6">
      {!hasData && (
        <section className="space-y-3">
          <div className="card flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div>
              <h2 className="text-[15px] font-semibold text-stone-900">Start with your first quote</h2>
              <p className="mt-0.5 text-sm text-stone-500">
                Send it with QuoteLoop, or track one you already sent.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/quotes?new=1" className="btn-primary">
                <Plus className="h-4 w-4" /> New quote
              </Link>
              <Link href="/settings" className="btn-secondary">
                Load demo data
              </Link>
            </div>
          </div>
          <HowItWorks />
        </section>
      )}

      {/* Hero: what needs doing, and how much money is riding on it */}
      <section className="overflow-hidden rounded-lg bg-stone-950 text-stone-300">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_1fr] lg:p-7">
          <div>
            <p className="text-xs text-stone-500">
              {greeting}
              {firstName ? `, ${firstName}` : ""} · {formatDate(today)}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[28px]">
              {needAttention > 0
                ? `${needAttention} follow-up${needAttention === 1 ? " needs" : "s need"} attention`
                : "You're all caught up"}
            </h1>
            <p className="mt-1.5 text-sm">
              {needAttention > 0 ? (
                <>
                  {m.overdue > 0 && <span className="font-medium text-red-400">{m.overdue} overdue</span>}
                  {m.overdue > 0 && m.dueToday > 0 && " · "}
                  {m.dueToday > 0 && <span className="font-medium text-brand-400">{m.dueToday} due today</span>}
                  <span className="text-stone-500"> — follow up before the customer goes cold.</span>
                </>
              ) : (
                "No follow-ups are due today."
              )}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/follow-ups" className="btn-accent">
                Review follow-ups <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/quotes?new=1"
                className="btn border border-white/15 bg-white/5 text-white hover:bg-white/10"
              >
                <Plus className="h-4 w-4" /> New quote
              </Link>
            </div>
          </div>

          <div className="border-t border-white/10 pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">
              Waiting in open quotes
            </p>
            <p className="num mt-2 text-4xl font-semibold tracking-tight text-white">
              {formatCurrency(m.openValue, currency)}
            </p>
            <p className="mt-1 text-sm text-stone-400">
              {m.openCount} open {m.openCount === 1 ? "quote" : "quotes"} ·{" "}
              <span className="num">{formatCurrency(m.totalQuoted, currency)}</span> quoted in total
            </p>
          </div>
        </div>
      </section>

      {/* Supporting numbers: one strip, not a grid of cards */}
      <section className="card grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x lg:divide-stone-100">
        <Metric label="Won" value={formatCurrency(m.acceptedValue, currency)} hint={`${m.wonCount} quote${m.wonCount === 1 ? "" : "s"}`} tone="won" />
        <Metric label="Lost" value={formatCurrency(m.lostValue, currency)} hint={`${m.lostCount} quote${m.lostCount === 1 ? "" : "s"}`} tone="lost" />
        <Metric
          label="Win rate"
          value={m.winRate === null ? "—" : `${m.winRate}%`}
          hint={m.winRate === null ? "Nothing won or lost yet" : `${m.wonCount} won / ${m.lostCount} lost`}
        />
        <Metric label="Average quote" value={formatCurrency(m.avgQuote, currency)} hint="Across quotes sent" />
        <Metric label="Quotes sent" value={String(m.quotesSent)} hint={`${m.activeLeads} active customers`} />
      </section>

      {/* The work */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
              <BellRing className="h-4 w-4 text-brand-600" /> Needs attention
            </h2>
            <Link href="/follow-ups" className="text-xs font-medium text-stone-500 hover:text-stone-900">
              All follow-ups →
            </Link>
          </div>
          {attention.length === 0 ? (
            <div className="p-4">
              <EmptyState
                compact
                icon={<CalendarCheck className="h-5 w-5" />}
                title="Nothing due right now"
                description="When a quote's next follow-up comes due, it appears here, ready to write."
              />
            </div>
          ) : (
            <AttentionList items={attention} today={today} />
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-stone-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-stone-900">Coming up</h2>
          </div>
          {upcoming.length === 0 ? (
            <p className="px-4 py-6 text-sm text-stone-500">
              No follow-ups scheduled yet. Add a quote and QuoteLoop schedules them.
            </p>
          ) : (
            <AttentionList items={upcoming} today={today} compact />
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "won" | "lost";
}) {
  return (
    <div className="border-b border-stone-100 px-4 py-3.5 lg:border-b-0">
      <p className="eyebrow">{label}</p>
      <p
        className={cn(
          "num mt-1 text-lg font-semibold",
          tone === "won" ? "text-emerald-700" : tone === "lost" ? "text-red-700" : "text-stone-900"
        )}
      >
        {value}
      </p>
      {hint && <p className="text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

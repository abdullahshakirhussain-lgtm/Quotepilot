"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { BellRing, Check, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { AIMessageModal } from "@/components/ai/AIMessageModal";
import type { FollowUpWithContext } from "@/lib/types";
import { cn, formatCurrency, formatDate, relativeDay } from "@/lib/utils";
import { classifyFollowUp, type FollowUpBucket } from "@/lib/follow-up-state";
import {
  completeFollowUp,
  reopenFollowUp,
  skipFollowUp,
} from "@/app/(app)/follow-ups/actions";

const SECTIONS: { key: Exclude<FollowUpBucket, "done">; title: string; accent: string }[] = [
  { key: "overdue", title: "Overdue", accent: "text-red-700" },
  { key: "today", title: "Due today", accent: "text-brand-700" },
  { key: "upcoming", title: "Upcoming", accent: "text-stone-700" },
];

export function FollowUpsClient({
  followUps,
  today,
  emailEnabled,
}: {
  followUps: FollowUpWithContext[];
  /** Server-computed date so grouping matches the dashboard and SSR. */
  today: string;
  /** Whether this workspace can send email at all. */
  emailEnabled: boolean;
}) {
  const [aiFor, setAiFor] = useState<FollowUpWithContext | null>(null);
  const [showDone, setShowDone] = useState(false);

  const groups = useMemo(() => {
    const buckets: Record<FollowUpBucket, FollowUpWithContext[]> = {
      overdue: [],
      today: [],
      upcoming: [],
      done: [],
    };
    for (const f of followUps) buckets[classifyFollowUp(f, today)].push(f);
    // Most recently completed first.
    buckets.done.sort((a, b) => (b.completed_at ?? b.due_date).localeCompare(a.completed_at ?? a.due_date));
    return buckets;
  }, [followUps, today]);

  const needAttention = groups.overdue.length + groups.today.length;

  return (
    <div>
      <PageHeader
        title="Follow-ups"
        subtitle={
          followUps.length === 0
            ? "Reminders for every quote you've sent."
            : `${needAttention} need${needAttention === 1 ? "s" : ""} attention · ${groups.upcoming.length} coming up`
        }
      />

      {followUps.length === 0 ? (
        <EmptyState
          icon={<BellRing className="h-5 w-5" />}
          title="No follow-ups due"
          description="Add a quote and QuoteLoop schedules its follow-ups here, each with a ready-to-write message."
          action={
            <Link href="/quotes" className="btn-primary">
              Go to quotes
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {SECTIONS.map((s) =>
            groups[s.key].length === 0 ? null : (
              <section key={s.key}>
                <h2 className={cn("mb-2 flex items-center gap-2 text-sm font-semibold", s.accent)}>
                  {s.title}
                  <span className="num rounded bg-stone-900/5 px-1.5 text-xs text-stone-500">
                    {groups[s.key].length}
                  </span>
                </h2>
                <ul className="card divide-y divide-stone-100">
                  {groups[s.key].map((f) => (
                    <FollowUpRow
                      key={f.id}
                      f={f}
                      today={today}
                      emailEnabled={emailEnabled}
                      onWrite={() => setAiFor(f)}
                    />
                  ))}
                </ul>
              </section>
            )
          )}

          {needAttention === 0 && groups.upcoming.length === 0 && (
            <p className="card px-4 py-6 text-sm text-stone-500">
              You&apos;re all caught up. New follow-ups appear when you add your next quote.
            </p>
          )}

          {groups.done.length > 0 && (
            <section>
              <button
                className="mb-2 flex items-center gap-1 text-sm font-semibold text-stone-500 hover:text-stone-900"
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
              >
                <ChevronRight className={cn("h-4 w-4 transition-transform", showDone && "rotate-90")} />
                Completed & skipped
                <span className="num rounded bg-stone-900/5 px-1.5 text-xs">{groups.done.length}</span>
              </button>
              {showDone && (
                <ul className="card divide-y divide-stone-100">
                  {groups.done.map((f) => (
                    <FollowUpRow
                      key={f.id}
                      f={f}
                      today={today}
                      emailEnabled={emailEnabled}
                      onWrite={() => setAiFor(f)}
                    />
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      {aiFor?.quote && (
        <AIMessageModal
          quote={{
            id: aiFor.quote.id,
            title: aiFor.quote.title,
            customerName: aiFor.lead?.customer_name ?? "the customer",
            amount: Number(aiFor.quote.amount),
            currency: aiFor.quote.currency,
            status: aiFor.quote.status,
            followUpCount: aiFor.quote.follow_up_count,
            validUntil: aiFor.quote.valid_until,
          }}
          today={today}
          onClose={() => setAiFor(null)}
        />
      )}
    </div>
  );
}

function FollowUpRow({
  f,
  today,
  emailEnabled,
  onWrite,
}: {
  f: FollowUpWithContext;
  today: string;
  emailEnabled: boolean;
  onWrite: () => void;
}) {
  const [pending, start] = useTransition();
  const bucket = classifyFollowUp(f, today);
  const isPending = f.status === "pending";
  const canEmail = emailEnabled && Boolean(f.lead?.email?.trim());
  const urgent = bucket === "overdue" || bucket === "today";

  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-stone-900">
            {f.lead?.customer_name ?? "—"}
          </span>
          <span className="text-xs text-stone-400">follow-up #{f.follow_up_number}</span>
          {!isPending && <StatusBadge kind="followup" value={f.status} />}
        </div>
        <div className="truncate text-sm text-stone-500">
          {f.quote?.title ?? "Quote"}
          {f.quote && (
            <span className="num"> · {formatCurrency(Number(f.quote.amount), f.quote.currency)}</span>
          )}
        </div>
        {isPending && !canEmail && (
          <p className="mt-0.5 text-xs text-stone-500">
            Add an email address to send from QuoteLoop, or copy the message.
          </p>
        )}
        {f.status === "completed" && f.message_snapshot && (
          <p className="mt-1 line-clamp-1 border-l-2 border-emerald-400 pl-2 text-xs italic text-stone-500">
            Final text used: {f.message_snapshot}
          </p>
        )}
      </div>

      <div className="text-sm sm:w-36 sm:text-right">
        <div
          className={cn(
            bucket === "overdue"
              ? "font-medium text-red-700"
              : bucket === "today"
                ? "font-medium text-brand-700"
                : "text-stone-600"
          )}
        >
          {isPending
            ? bucket === "today"
              ? "Due today"
              : relativeDay(f.due_date, today).replace(/^./, (c) => c.toUpperCase())
            : f.completed_at
              ? `Done ${formatDate(f.completed_at)}`
              : "Skipped"}
        </div>
        <div className="text-xs text-stone-400">{formatDate(f.due_date)}</div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:justify-end">
        {pending && <Loader2 className="h-4 w-4 animate-spin text-stone-400" />}
        {isPending ? (
          <>
            <button
              className="btn-ghost text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
              disabled={pending}
              onClick={() => start(async () => await completeFollowUp(f.id))}
              title="Mark as followed up without writing a message"
            >
              <Check className="h-4 w-4" /> Done
            </button>
            <button className={urgent ? "btn-accent" : "btn-secondary"} disabled={pending} onClick={onWrite}>
              <Sparkles className="h-4 w-4" /> Write follow-up
            </button>
            <Menu>
              <MenuItem onClick={() => start(async () => await skipFollowUp(f.id))}>
                Skip this reminder
              </MenuItem>
            </Menu>
          </>
        ) : (
          <>
            <button className="btn-ghost" disabled={pending} onClick={onWrite}>
              View messages
            </button>
            <Menu>
              <MenuItem onClick={() => start(async () => await reopenFollowUp(f.id))}>
                Reopen reminder
              </MenuItem>
            </Menu>
          </>
        )}
      </div>
    </li>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { BellRing, Check, ChevronRight, Loader2, PenLine } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DueChip } from "@/components/ui/DueChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Menu, MenuDivider, MenuItem, MenuLabel } from "@/components/ui/Menu";
import { AIMessageModal } from "@/components/ai/AIMessageModal";
import type { ActionResult, FollowUpWithContext } from "@/lib/types";
import { isSampleAddress } from "@/lib/email-address";
import { SampleBadge, SampleDataBanner } from "@/components/SampleData";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  classifyFollowUp,
  onePerQuote,
  type FollowUpBucket,
} from "@/lib/follow-up-state";
import {
  completeFollowUp,
  reopenFollowUp,
  skipFollowUp,
  snoozeFollowUp,
} from "@/app/(app)/follow-ups/actions";

type Row = FollowUpWithContext & { dueCount?: number; laterCount?: number };

const SNOOZE_CHOICES: { days: number; label: string }[] = [
  { days: 1, label: "Remind me tomorrow" },
  { days: 3, label: "Remind me in 3 days" },
  { days: 7, label: "Remind me next week" },
  { days: 14, label: "Remind me in 2 weeks" },
];

/** A request that never reached the server: usually a dropped connection, or a session that ended in another tab. */
const OFFLINE_OR_SIGNED_OUT =
  "That didn't go through, so nothing changed. You may have lost your connection, or been signed out in another tab. Refresh the page and try again.";

/** Quote statuses whose reminders can't be reopened. */
const CLOSED_QUOTE = ["accepted", "rejected", "expired"];

const SECTIONS: {
  key: Exclude<FollowUpBucket, "done">;
  title: string;
  /** The count's chip: red late, amber today, blue coming up. */
  chip: string;
}[] = [
  { key: "overdue", title: "Overdue", chip: "chip-late" },
  { key: "today", title: "Due today", chip: "chip-today" },
  { key: "upcoming", title: "Coming up", chip: "chip-soon" },
];

export function FollowUpsClient({
  followUps,
  today,
  emailEnabled,
  moreDone = false,
  quoteId = null,
}: {
  followUps: FollowUpWithContext[];
  /** Server-computed date so grouping matches the dashboard and SSR. */
  today: string;
  /** Whether this workspace can send email at all. */
  emailEnabled: boolean;
  /** Older finished reminders exist beyond the ones listed. */
  moreDone?: boolean;
  /** Show only this quote's reminders ("View follow-ups" on a quote). */
  quoteId?: string | null;
}) {
  const [aiFor, setAiFor] = useState<FollowUpWithContext | null>(null);
  const [showDone, setShowDone] = useState(false);
  // A message from a row that then moved out of view (e.g. into the closed
  // "Completed & skipped" list when the page refreshed).
  const [notice, setNotice] = useState<string | null>(null);

  // Only one quote's reminders when opened from that quote, if it has any here.
  const forQuote = useMemo(
    () => (quoteId ? followUps.filter((f) => f.quote_id === quoteId) : []),
    [followUps, quoteId],
  );
  const filtered = forQuote.length > 0;
  const shown = filtered ? forQuote : followUps;
  const quoteTitle = forQuote[0]?.quote?.title ?? null;

  const groups = useMemo(() => {
    const buckets: Record<FollowUpBucket, Row[]> = {
      overdue: [],
      today: [],
      upcoming: [],
      done: [],
    };
    // One row per quote: its due reminder, or else its next one. Opened for a
    // single quote ("View follow-ups"), its whole schedule is listed instead.
    for (const f of filtered ? shown : onePerQuote(shown, today))
      buckets[classifyFollowUp(f, today)].push(f);
    // Most recently completed first.
    buckets.done.sort((a, b) =>
      (b.completed_at ?? b.due_date).localeCompare(
        a.completed_at ?? a.due_date,
      ),
    );
    return buckets;
  }, [shown, filtered, today]);

  const needAttention = groups.overdue.length + groups.today.length;

  return (
    <div>
      <PageHeader
        title="Follow-ups"
        subtitle={
          followUps.length === 0
            ? "Reminders for every quote you've sent."
            : `${needAttention} need${needAttention === 1 ? "s" : ""} attention, ${groups.upcoming.length} coming up`
        }
      />

      {followUps.some((f) => isSampleAddress(f.lead?.email)) && (
        <SampleDataBanner />
      )}

      {filtered && (
        <div className="msg-info mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <span className="min-w-0 [overflow-wrap:anywhere]">
            Showing reminders for{" "}
            <span className="font-semibold text-stone-900">
              {quoteTitle ?? "one quote"}
            </span>
          </span>
          <Link
            href="/follow-ups"
            className="tap inline-flex shrink-0 items-center font-medium text-info-700 hover:underline"
          >
            Show all follow-ups
          </Link>
        </div>
      )}

      {notice && (
        <div
          role="alert"
          className="ql-fade mb-4 flex items-start justify-between gap-3 rounded-[6px] border-2 border-brand-400 bg-brand-50 px-4 py-2.5 text-[15px] text-stone-900"
        >
          <span>{notice}</span>
          <button
            className="tap -my-1 shrink-0 font-medium text-info-700 hover:underline"
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </div>
      )}

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
        <div className="flex flex-col gap-4">
          {SECTIONS.map((s, si) =>
            groups[s.key].length === 0 ? null : (
              <section key={s.key} aria-labelledby={`fu-${s.key}`} className="card ql-in" style={{ animationDelay: `${si * 60}ms` }}>
                <div className="card-head">
                  <h2 id={`fu-${s.key}`} className="card-title">
                    {s.title}
                  </h2>
                  <span className={cn("num", s.chip)}>{groups[s.key].length}</span>
                </div>
                <ul className="divide-y divide-[#ECEEF1]">
                  {groups[s.key].map((f, i) => (
                    <FollowUpRow
                      key={f.id}
                      f={f}
                      index={si * 2 + i}
                      today={today}
                      emailEnabled={emailEnabled}
                      onWrite={() => setAiFor(f)}
                      onLostMessage={setNotice}
                    />
                  ))}
                </ul>
              </section>
            ),
          )}

          {needAttention === 0 && groups.upcoming.length === 0 && (
            <p className="card ql-fade px-5 py-6 text-[14px] text-stone-500">
              You&apos;re all caught up. New follow-ups appear when you add your
              next quote.
            </p>
          )}

          {groups.done.length > 0 && (
            <section className="card">
              <button
                className="tap flex w-full items-center gap-2 px-5 py-4 text-left text-[16px] font-medium text-stone-700 hover:text-stone-900"
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
              >
                <ChevronRight
                  className={cn(
                    "h-5 w-5 transition-transform duration-200 ease-board",
                    showDone && "rotate-90",
                  )}
                />
                Completed and skipped
                <span className="num chip-muted">{groups.done.length}</span>
              </button>
              {showDone && moreDone && (
                <p className="px-5 pb-3 text-[14px] text-stone-500">
                  Showing the latest {groups.done.length}. Export follow-ups in
                  Settings for the full history.
                </p>
              )}
              {showDone && (
                <ul className="divide-y divide-[#ECEEF1] border-t border-[#ECEEF1]">
                  {groups.done.map((f, i) => (
                    <FollowUpRow
                      key={f.id}
                      f={f}
                      index={i}
                      today={today}
                      emailEnabled={emailEnabled}
                      onWrite={() => setAiFor(f)}
                      onLostMessage={setNotice}
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
  index,
  today,
  emailEnabled,
  onWrite,
  onLostMessage,
}: {
  f: Row;
  /** Position in the list, for the staggered entrance. */
  index: number;
  today: string;
  emailEnabled: boolean;
  onWrite: () => void;
  /** Takes over this row's message if the row leaves the list while showing one. */
  onLostMessage: (message: string) => void;
}) {
  const [pending, start] = useTransition();
  const [rowError, setRowError] = useState<string | null>(null);
  const shownError = useRef<string | null>(null);
  const bucket = classifyFollowUp(f, today);

  const showError = (message: string | null) => {
    shownError.current = message;
    setRowError(message);
  };
  // A refused "Mark followed up" can refresh the page and move this reminder into the closed
  // "Completed and skipped" list; its explanation then moves to the top.
  useEffect(
    () => () => {
      if (shownError.current) onLostMessage(shownError.current);
    },
    [onLostMessage],
  );

  // A failed "Mark followed up" / Skip / Reopen is shown on this row, not as an error page.
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      showError(null);
      try {
        const result = await fn();
        if (!result.ok) showError(result.error);
      } catch (e) {
        unstable_rethrow(e); // a redirect Next is handling itself must not be swallowed
        showError(OFFLINE_OR_SIGNED_OUT);
      }
    });
  const isPending = f.status === "pending";
  const canEmail = emailEnabled && Boolean(f.lead?.email?.trim());
  const urgent = bucket === "overdue" || bucket === "today";
  const extra = [
    (f.dueCount ?? 1) > 1 ? `${f.dueCount} reminders missed` : null,
    (f.laterCount ?? 0) > 0 ? `then ${f.laterCount} more scheduled` : null,
  ].filter(Boolean);
  const menuLabel = `More actions for ${f.lead?.customer_name ?? "this follow-up"}`;

  return (
    // Side by side from laptop width; stacked on phones and tablets.
    <li
      className="ql-in relative grid grid-cols-1 gap-x-6 gap-y-3 px-4 py-4 transition-colors hover:bg-stone-50/60 sm:px-5 lg:grid-cols-[minmax(0,1fr)_8rem_auto] lg:items-center"
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      {/* Room on the right for the ⋯ menu, which sits in the corner on phones. */}
      <div className="min-w-0 pr-12 lg:pr-0">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="text-[16px] font-medium leading-snug text-stone-900 [overflow-wrap:anywhere]">
            {f.lead?.customer_name ?? "Customer"}
          </span>
          <span className="whitespace-nowrap text-[13px] text-stone-500">
            Follow-up {f.follow_up_number}
          </span>
          {!isPending && <StatusBadge kind="followup" value={f.status} />}
          {isSampleAddress(f.lead?.email) && <SampleBadge />}
        </div>
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-3 text-[14px] text-stone-600">
          <span className="min-w-0 [overflow-wrap:anywhere]">
            {f.quote?.title ?? "Quote"}
          </span>
          {f.quote && (
            <span className="num whitespace-nowrap font-semibold text-stone-900">
              {formatCurrency(Number(f.quote.amount), f.quote.currency)}
            </span>
          )}
        </p>
        {extra.length > 0 && (
          <p
            className="mt-0.5 text-[13px] text-stone-500"
            title="One follow-up covers all the missed reminders."
          >
            {extra.join(", ")}
          </p>
        )}
        {isPending && !canEmail && (
          <p className="mt-0.5 text-[13px] text-stone-500">
            Add an email address to send from QuoteLoop, or copy the message.
          </p>
        )}
        {rowError && (
          <p role="alert" className="mt-1 text-[14px] font-medium text-red-700">
            {rowError}
          </p>
        )}
        {f.status === "completed" && f.message_snapshot && (
          <p className="mt-1 line-clamp-1 border-l-2 border-emerald-500 pl-2 text-[13px] text-stone-500">
            Final text used: {f.message_snapshot}
          </p>
        )}
      </div>

      {/* When: a chip while it's waiting (exact date on hover), plain words once done. */}
      <div className="flex items-center lg:justify-end">
        {isPending ? (
          <DueChip dueDate={f.due_date} today={today} />
        ) : (
          <span className="text-[13px] text-stone-500">
            {f.completed_at ? `Followed up ${formatDate(f.completed_at)}` : "Skipped"}
          </span>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 lg:flex-nowrap lg:justify-end">
        {pending && <Loader2 className="h-4 w-4 animate-spin text-stone-500" />}
        {isPending ? (
          <>
            <button
              className={urgent ? "btn-primary" : "btn-secondary"}
              disabled={pending}
              onClick={onWrite}
            >
              <PenLine className="h-4 w-4" /> Write follow-up
            </button>
            {/* Records a follow-up the user made themselves; nothing is sent.
                A plain outlined button with the full label, so it reads as
                something to press, never as "already done". */}
            <button
              className="btn-secondary"
              disabled={pending}
              onClick={() => run(() => completeFollowUp(f.id))}
              title="Record that you followed up yourself. Nothing is sent."
            >
              <Check className="h-4 w-4" /> Mark followed up
            </button>
            <div className="absolute right-3 top-3 lg:static">
              <Menu label={menuLabel}>
                <MenuLabel>Remind me later</MenuLabel>
                {SNOOZE_CHOICES.map((c) => (
                  <MenuItem
                    key={c.days}
                    onClick={() => run(() => snoozeFollowUp(f.id, c.days))}
                  >
                    {c.label}
                  </MenuItem>
                ))}
                <MenuDivider />
                <MenuItem onClick={() => run(() => skipFollowUp(f.id))}>
                  {(f.dueCount ?? 1) > 1
                    ? "Skip these reminders"
                    : "Skip this reminder"}
                </MenuItem>
              </Menu>
            </div>
          </>
        ) : (
          <>
            <button className="btn-ghost" disabled={pending} onClick={onWrite}>
              View messages
            </button>
            {/* A won, lost or expired quote's reminders stay closed. */}
            {!CLOSED_QUOTE.includes(f.quote?.status ?? "") && (
              <Menu label={menuLabel}>
                <MenuItem onClick={() => run(() => reopenFollowUp(f.id))}>
                  Reopen reminder
                </MenuItem>
              </Menu>
            )}
          </>
        )}
      </div>
    </li>
  );
}

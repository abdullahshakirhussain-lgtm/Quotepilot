"use client";

import { useMemo, useState, useTransition } from "react";
import {
  BellRing,
  CalendarClock,
  Check,
  Clock,
  Loader2,
  RotateCcw,
  Sparkles,
  SkipForward,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { AIMessageModal } from "@/components/ai/AIMessageModal";
import type { FollowUpWithContext } from "@/lib/types";
import { formatCurrency, formatDate, relativeDay, todayISO } from "@/lib/utils";
import {
  completeFollowUp,
  reopenFollowUp,
  skipFollowUp,
} from "@/app/(app)/follow-ups/actions";

export function FollowUpsClient({
  followUps,
}: {
  followUps: FollowUpWithContext[];
}) {
  const [aiFor, setAiFor] = useState<FollowUpWithContext | null>(null);
  const today = todayISO();

  const groups = useMemo(() => {
    const overdue: FollowUpWithContext[] = [];
    const dueToday: FollowUpWithContext[] = [];
    const upcoming: FollowUpWithContext[] = [];
    const done: FollowUpWithContext[] = [];

    for (const f of followUps) {
      const d = f.due_date.slice(0, 10);
      if (f.status !== "pending") done.push(f);
      else if (d < today) overdue.push(f);
      else if (d === today) dueToday.push(f);
      else upcoming.push(f);
    }
    return { overdue, dueToday, upcoming, done };
  }, [followUps, today]);

  const totalPending =
    groups.overdue.length + groups.dueToday.length + groups.upcoming.length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Follow-ups</h1>
        <p className="mt-1 text-sm text-slate-500">
          {totalPending} pending · {groups.done.length} done
        </p>
      </header>

      {followUps.length === 0 ? (
        <EmptyState
          icon={<BellRing className="h-6 w-6" />}
          title="No follow-ups scheduled"
          description="Mark a quote as sent and QuotePilot will schedule follow-up reminders here automatically."
          action={
            <a href="/quotes" className="btn-primary">
              Go to quotes
            </a>
          }
        />
      ) : (
        <>
          <Section
            title="Due today"
            accent="text-amber-700"
            icon={<CalendarClock className="h-4 w-4" />}
            items={groups.dueToday}
            onAI={setAiFor}
          />
          <Section
            title="Overdue"
            accent="text-red-700"
            icon={<Clock className="h-4 w-4" />}
            items={groups.overdue}
            onAI={setAiFor}
          />
          <Section
            title="Upcoming"
            accent="text-slate-700"
            icon={<BellRing className="h-4 w-4" />}
            items={groups.upcoming}
            onAI={setAiFor}
          />
          <Section
            title="Completed & skipped"
            accent="text-slate-500"
            icon={<Check className="h-4 w-4" />}
            items={groups.done}
            onAI={setAiFor}
            muted
          />
        </>
      )}

      {aiFor && (
        <AIMessageModal
          quote={{
            id: aiFor.quote?.id ?? aiFor.quote_id,
            title: aiFor.quote?.title ?? "Quote",
            customerName: aiFor.lead?.customer_name ?? "the customer",
          }}
          onClose={() => setAiFor(null)}
        />
      )}
    </div>
  );
}

function Section({
  title,
  accent,
  icon,
  items,
  onAI,
  muted,
}: {
  title: string;
  accent: string;
  icon: React.ReactNode;
  items: FollowUpWithContext[];
  onAI: (f: FollowUpWithContext) => void;
  muted?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className={`mb-2 flex items-center gap-2 text-sm font-semibold ${accent}`}>
        {icon}
        {title}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
          {items.length}
        </span>
      </h2>
      <div className="card divide-y divide-slate-100">
        {items.map((f) => (
          <FollowUpRow key={f.id} f={f} onAI={onAI} muted={muted} />
        ))}
      </div>
    </section>
  );
}

function FollowUpRow({
  f,
  onAI,
  muted,
}: {
  f: FollowUpWithContext;
  onAI: (f: FollowUpWithContext) => void;
  muted?: boolean;
}) {
  const [pending, start] = useTransition();
  const isPending = f.status === "pending";

  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-slate-900">
            {f.quote?.title ?? "Quote"}
          </span>
          <span className="text-xs text-slate-400">#{f.follow_up_number}</span>
        </div>
        <div className="truncate text-sm text-slate-500">
          {f.lead?.customer_name ?? "—"}
          {f.quote ? ` · ${formatCurrency(Number(f.quote.amount), f.quote.currency)}` : ""}
        </div>
      </div>

      <div className="text-right text-sm">
        <div className={muted ? "text-slate-400" : "font-medium text-slate-700"}>
          {formatDate(f.due_date)}
        </div>
        <div className="text-xs text-slate-400">
          {f.status === "pending" ? relativeDay(f.due_date) : null}
          {f.status !== "pending" && (
            <StatusBadge kind="followup" value={f.status} />
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          className="btn-ghost px-2 py-1"
          title="Generate AI follow-up"
          onClick={() => onAI(f)}
        >
          <Sparkles className="h-4 w-4" />
        </button>

        {isPending ? (
          <>
            <button
              className="btn px-2.5 py-1 text-sm text-emerald-700 hover:bg-emerald-50"
              disabled={pending}
              onClick={() => start(async () => await completeFollowUp(f.id))}
              title="Mark done"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </button>
            <button
              className="btn-ghost px-2.5 py-1 text-sm"
              disabled={pending}
              onClick={() => start(async () => await skipFollowUp(f.id))}
              title="Skip"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            className="btn-ghost px-2.5 py-1 text-sm"
            disabled={pending}
            onClick={() => start(async () => await reopenFollowUp(f.id))}
            title="Reopen"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { BellRing, Check, Sparkles } from "lucide-react";
import { formatDate, relativeDay } from "@/lib/utils";
import type { QuoteFlowOutcome } from "@/lib/quote-flows";

export type QuoteSuccess = Extract<QuoteFlowOutcome, { ok: true }>;

/**
 * What happened, and what to do next. The wording depends on whether a
 * follow-up is already due: a reminder that is still in the future must never
 * be described as due, and one that has already passed must not be hidden.
 */
export function QuoteDonePanel({
  result,
  today,
  onWriteFollowUp,
  onAnother,
}: {
  result: QuoteSuccess;
  /** Viewer's local date from the server. */
  today: string;
  onWriteFollowUp: () => void;
  onAnother: () => void;
}) {
  const firstDue = result.schedule[0] ?? null;
  const overdueCount = result.schedule.filter((f) => f.due_date.slice(0, 10) <= today).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-md bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900 ring-1 ring-inset ring-emerald-200">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <span>
          {result.recipient ? (
            <>
              Sent to <span className="font-medium">{result.recipient}</span>. {result.customerName} has your
              quote.
            </>
          ) : (
            <>
              Saved for {result.customerName}.
              {firstDue && !result.followUpDueNow
                ? ` Follow-up #${firstDue.follow_up_number} is scheduled for ${formatDate(
                    firstDue.due_date,
                  )}.`
                : ""}
            </>
          )}
        </span>
      </div>

      {result.followUpDueNow && (
        <div className="flex items-start gap-3 rounded-md bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
          <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            This quote already needs a follow-up.{" "}
            {overdueCount > 1
              ? `${overdueCount} reminders are due, counting from the date you sent it.`
              : "Its first reminder is due, counting from the date you sent it."}
          </span>
        </div>
      )}

      {result.warning && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
          {result.warning}
        </div>
      )}

      {result.schedule.length > 0 && (
        <div>
          <p className="eyebrow mb-2">Follow-up schedule</p>
          <ul className="divide-y divide-stone-100 rounded-md border border-stone-200 text-sm">
            {result.schedule.map((f) => {
              const due = f.due_date.slice(0, 10) <= today;
              return (
                <li key={f.follow_up_number} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-stone-700">Follow-up #{f.follow_up_number}</span>
                  <span className={due ? "font-medium text-amber-700" : "text-stone-500"}>
                    {formatDate(f.due_date)} ·{" "}
                    {f.due_date.slice(0, 10) < today ? "overdue" : relativeDay(f.due_date, today)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!result.hasCustomerEmail && (
        <p className="text-sm text-stone-500">
          Add an email address to this customer to send follow-ups from QuoteLoop. For now you can copy each
          message.
        </p>
      )}

      <div className="border-t border-stone-200 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          {result.followUpDueNow ? (
            <>
              <button type="button" className="btn-accent" onClick={onWriteFollowUp}>
                <Sparkles className="h-4 w-4" /> Write follow-up now
              </button>
              <Link href="/follow-ups" className="btn-secondary">
                View follow-ups
              </Link>
            </>
          ) : (
            <>
              <Link href="/follow-ups" className="btn-primary">
                View follow-ups
              </Link>
              <button type="button" className="btn-secondary" onClick={onWriteFollowUp}>
                <Sparkles className="h-4 w-4" /> Write early follow-up
              </button>
            </>
          )}
          <button type="button" className="btn-ghost ml-auto" onClick={onAnother}>
            Create another quote
          </button>
        </div>
        {!result.followUpDueNow && firstDue && (
          <p className="mt-2 text-xs text-stone-500">
            Your first reminder is scheduled for {formatDate(firstDue.due_date)}, but you can write a
            follow-up early if you want.
          </p>
        )}
      </div>
    </div>
  );
}

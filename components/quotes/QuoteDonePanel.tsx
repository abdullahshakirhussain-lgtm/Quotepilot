"use client";

import Link from "next/link";
import { BellRing, Check, PenLine } from "lucide-react";
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
  summary,
  today,
  onWriteFollowUp,
  onAnother,
}: {
  result: QuoteSuccess;
  /** What was saved, e.g. "Deep clean, $1,250.00". */
  summary?: string;
  /** Viewer's local date from the server. */
  today: string;
  onWriteFollowUp: () => void;
  onAnother: () => void;
}) {
  const firstDue = result.schedule[0] ?? null;
  const overdueCount = result.schedule.filter((f) => f.due_date.slice(0, 10) <= today).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 msg-success">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
        {/* min-w-0 + anywhere: a long unbroken title wraps instead of running out of the dialog. */}
        <span className="min-w-0 [overflow-wrap:anywhere]">
          {result.recipient ? (
            <>
              Sent to <span className="font-semibold">{result.recipient}</span>. {result.customerName} has your
              quote{summary ? <>: <span className="num font-semibold">{summary}</span></> : null}.
            </>
          ) : (
            <>
              Saved for {result.customerName}
              {summary ? (
                <>
                  : <span className="num font-semibold">{summary}</span>
                </>
              ) : null}
              .
              {firstDue && !result.followUpDueNow
                ? ` Follow-up ${firstDue.follow_up_number} is scheduled for ${formatDate(
                    firstDue.due_date,
                  )}.`
                : ""}
            </>
          )}
        </span>
      </div>

      {result.followUpDueNow && (
        <div className="flex items-start gap-3 msg-warn">
          <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-stone-900" />
          <span>
            This quote already needs a follow-up.{" "}
            {overdueCount > 1
              ? `${overdueCount} reminders are due, counting from the date you sent it.`
              : "Its first reminder is due, counting from the date you sent it."}
          </span>
        </div>
      )}

      {result.warning && (
        <div className="msg-warn">
          {result.warning}
        </div>
      )}

      {result.schedule.length > 0 && (
        <div>
          <p className="section-title mb-2">Follow-up schedule</p>
          <ul className="divide-y divide-[#ECEEF1] rounded-[10px] border border-line px-3 text-[14px]">
            {result.schedule.map((f) => {
              const due = f.due_date.slice(0, 10) <= today;
              return (
                <li key={f.follow_up_number} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="font-semibold text-stone-900">Follow-up {f.follow_up_number}</span>
                  <span className={due ? "num font-semibold text-red-700" : "num text-stone-700"}>
                    {formatDate(f.due_date)},{" "}
                    {f.due_date.slice(0, 10) < today ? "overdue" : relativeDay(f.due_date, today)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!result.hasCustomerEmail && (
        <p className="hint">
          Add an email address to this customer to send follow-ups from QuoteLoop. For now you can copy each
          message.
        </p>
      )}

      <div className="border-t border-stone-200 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          {result.followUpDueNow ? (
            <>
              <button type="button" className="btn-primary" onClick={onWriteFollowUp}>
                <PenLine className="h-4 w-4" /> Write follow-up now
              </button>
              <Link href={`/follow-ups?quote=${result.quoteId}`} className="btn-secondary">
                View follow-ups
              </Link>
            </>
          ) : (
            <>
              <Link href={`/follow-ups?quote=${result.quoteId}`} className="btn-primary">
                View follow-ups
              </Link>
              <button type="button" className="btn-secondary" onClick={onWriteFollowUp}>
                <PenLine className="h-4 w-4" /> Write early follow-up
              </button>
            </>
          )}
          <button type="button" className="btn-ghost ml-auto" onClick={onAnother}>
            Create another quote
          </button>
        </div>
        {!result.followUpDueNow && firstDue && (
          <p className="mt-2 hint">
            Your first reminder is scheduled for {formatDate(firstDue.due_date)}, but you can write a
            follow-up early if you want.
          </p>
        )}
      </div>
    </div>
  );
}

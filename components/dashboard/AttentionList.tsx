"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { AIMessageModal } from "@/components/ai/AIMessageModal";
import type { FollowUpWithContext } from "@/lib/types";
import { cn, formatCurrency, relativeDay } from "@/lib/utils";
import { classifyFollowUp } from "@/lib/follow-up-state";

/** Follow-up task rows with a one-click "Write follow-up". */
export function AttentionList({
  items,
  today,
  compact,
}: {
  items: FollowUpWithContext[];
  /** Viewer's local date from the server. */
  today: string;
  /** Narrow column: hide the amount and use a smaller button. */
  compact?: boolean;
}) {
  const [aiFor, setAiFor] = useState<FollowUpWithContext | null>(null);

  return (
    <>
      <ul className="divide-y divide-stone-100">
        {items.map((f) => {
          const bucket = classifyFollowUp(f, today);
          const urgent = bucket === "overdue" || bucket === "today";
          return (
            <li key={f.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  bucket === "overdue" ? "bg-red-500" : bucket === "today" ? "bg-brand-500" : "bg-stone-300"
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-stone-900">
                  {f.lead?.customer_name ?? "—"}
                  <span className="font-normal text-stone-500"> · {f.quote?.title ?? "Quote"}</span>
                </div>
                <div className="text-xs">
                  <span
                    className={cn(
                      bucket === "overdue"
                        ? "font-medium text-red-700"
                        : bucket === "today"
                          ? "font-medium text-brand-700"
                          : "text-stone-500"
                    )}
                  >
                    {bucket === "overdue"
                      ? `Overdue · was due ${relativeDay(f.due_date, today)}`
                      : bucket === "today"
                        ? "Due today"
                        : `Due ${relativeDay(f.due_date, today)}`}
                  </span>
                  <span className="text-stone-400"> · follow-up #{f.follow_up_number}</span>
                </div>
              </div>
              {f.quote && !compact && (
                <span className="num hidden text-sm font-semibold text-stone-900 sm:block">
                  {formatCurrency(Number(f.quote.amount), f.quote.currency)}
                </span>
              )}
              {f.quote && (
                <button
                  className={cn(
                    "tap shrink-0",
                    compact
                      ? "btn-ghost px-2 py-1 text-xs"
                      : urgent
                        ? "btn-accent px-2.5 py-1 text-xs"
                        : "btn-secondary px-2.5 py-1 text-xs"
                  )}
                  onClick={() => setAiFor(f)}
                  title={`Write a follow-up to ${f.lead?.customer_name ?? "this customer"}`}
                >
                  <Sparkles className="h-3.5 w-3.5" /> {compact ? "Draft" : "Write follow-up"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

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
    </>
  );
}

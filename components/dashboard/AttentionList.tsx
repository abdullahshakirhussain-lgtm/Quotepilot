"use client";

import { useState } from "react";
import { AIMessageModal } from "@/components/ai/AIMessageModal";
import { SampleBadge } from "@/components/SampleData";
import type { FollowUpWithContext } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { dueLabel } from "@/components/ui/DueChip";
import { isSampleAddress } from "@/lib/email-address";
import { useOpenQuote } from "@/components/quotes/QuotePanel";

/**
 * The quotes to follow up now: who, how late, how much, and one "Write".
 */
export function AttentionList({
  items,
  today,
}: {
  /** `dueCount`: how many of the quote's reminders are due (one row per quote). */
  items: Array<FollowUpWithContext & { dueCount?: number }>;
  /** Viewer's local date from the server. */
  today: string;
}) {
  const [aiFor, setAiFor] = useState<FollowUpWithContext | null>(null);
  const openQuote = useOpenQuote();

  return (
    <>
      <ul className="flex flex-col divide-y divide-[#ECEEF1]">
        {items.map((f) => {
          const due = dueLabel(f.due_date, today);
          return (
            <li key={f.id} className="flex items-center gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 font-medium text-stone-900 [overflow-wrap:anywhere]">
                  {f.quote ? (
                    <button type="button" className="tap inline-flex items-center text-left hover:underline" onClick={() => openQuote(f.quote!.id)}>
                      {f.lead?.customer_name ?? "Customer"}
                    </button>
                  ) : (
                    (f.lead?.customer_name ?? "Customer")
                  )}
                  {isSampleAddress(f.lead?.email) && <SampleBadge />}
                </div>
                <div className="text-[13px] text-stone-600 [overflow-wrap:anywhere]">
                  {f.quote?.title && <>{f.quote.title}, </>}
                  <span className={due.bucket === "overdue" ? "font-medium text-red-700" : due.bucket === "today" ? "font-medium text-due-800" : undefined}>
                    {due.bucket === "today" ? "due today" : due.text}
                  </span>
                  {(f.dueCount ?? 1) > 1 && <>, {f.dueCount} reminders missed</>}
                </div>
              </div>
              {f.quote && (
                <span className="num shrink-0 font-medium text-stone-900">{formatCurrency(Number(f.quote.amount), f.quote.currency)}</span>
              )}
              {f.quote && (
                <button
                  className="btn-secondary shrink-0 px-3"
                  onClick={() => setAiFor(f)}
                  aria-label={`Write follow-up to ${f.lead?.customer_name ?? "this customer"}`}
                >
                  Write
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

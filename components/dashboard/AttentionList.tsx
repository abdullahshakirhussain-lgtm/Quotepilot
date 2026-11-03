"use client";

import { useState } from "react";
import { AIMessageModal } from "@/components/ai/AIMessageModal";
import { SampleBadge } from "@/components/SampleData";
import type { FollowUpWithContext } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { DueChip } from "@/components/ui/DueChip";
import { isSampleAddress } from "@/lib/email-address";

/**
 * The quotes to follow up now, each with a one-click "Write". Rows ease in
 * one after another when the page loads.
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

  return (
    <>
      <ul className="flex flex-col divide-y divide-[#ECEEF1] px-5">
        {items.map((f, i) => (
          <li key={f.id} className="ql-in flex items-center gap-3 py-3" style={{ animationDelay: `${80 + i * 40}ms` }}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 font-medium text-stone-900 [overflow-wrap:anywhere]">
                {f.lead?.customer_name ?? "Customer"}
                {isSampleAddress(f.lead?.email) && <SampleBadge />}
              </div>
              <div className="text-[13px] text-stone-500 [overflow-wrap:anywhere]">
                {f.quote ? formatCurrency(Number(f.quote.amount), f.quote.currency) : "Quote"}
                {(f.dueCount ?? 1) > 1 && <>, {f.dueCount} reminders missed</>}
              </div>
            </div>
            <DueChip dueDate={f.due_date} today={today} />
            {f.quote && (
              <button
                className="btn-primary shrink-0 px-3"
                onClick={() => setAiFor(f)}
                aria-label={`Write follow-up to ${f.lead?.customer_name ?? "this customer"}`}
              >
                Write
              </button>
            )}
          </li>
        ))}
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

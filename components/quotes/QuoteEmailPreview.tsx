"use client";

import { defaultQuoteSubject } from "@/lib/quote-email";
import { formatCurrency } from "@/lib/utils";

/** The quote email exactly as it will go out, with subject and body editable. */
export function QuoteEmailPreview({
  to,
  subject,
  onSubjectChange,
  body,
  onBodyChange,
  title,
  amount,
  currency,
  description,
  businessName,
  replyTo,
}: {
  to: string;
  subject: string;
  onSubjectChange: (value: string) => void;
  body: string;
  onBodyChange: (value: string) => void;
  title: string;
  amount: number;
  currency: string;
  description?: string | null;
  businessName: string;
  replyTo?: string | null;
}) {
  return (
    <div className="space-y-3">
      <div className="divide-y divide-stone-200 rounded-[6px] border border-stone-300 text-sm">
        <div className="flex items-start gap-3 px-3 py-2">
          <span className="w-16 shrink-0 text-stone-600">To</span>
          {/* Wraps rather than truncates: the whole address must be checkable. */}
          <span className="min-w-0 font-medium text-stone-800 [overflow-wrap:anywhere]">{to}</span>
        </div>
        <div className="flex items-center gap-3 px-3 py-1.5">
          <label htmlFor="quote-subject" className="w-16 shrink-0 text-stone-600">
            Subject
          </label>
          <input
            id="quote-subject"
            className="w-full bg-transparent py-0.5 text-base text-stone-900 focus:outline-none"
            value={subject}
            maxLength={200}
            placeholder={defaultQuoteSubject(businessName, title)}
            onChange={(e) => onSubjectChange(e.target.value)}
          />
        </div>
        <div className="flex items-start gap-3 px-3 py-2">
          <span className="w-16 shrink-0 text-stone-600">From</span>
          <span className="min-w-0 text-stone-700 [overflow-wrap:anywhere]">
            {businessName || "Your business"} via QuoteLoop
            {replyTo ? `, replies go to ${replyTo}` : ""}
          </span>
        </div>
      </div>

      <textarea
        aria-label="Quote email"
        className="input min-h-[210px] resize-y leading-relaxed"
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
      />

      <div className="msg-info">
        <p>
          <span className="font-semibold text-stone-900">{title}</span>,{" "}
          <span className="num font-semibold">{formatCurrency(amount, currency)}</span>
          {description ? <span className="text-stone-600">. {description}</span> : null}
        </p>
        <p className="mt-1 text-stone-600">
          A short line naming your business is added at the end. Nothing is sent until you press Send
          quote email.
        </p>
      </div>
    </div>
  );
}

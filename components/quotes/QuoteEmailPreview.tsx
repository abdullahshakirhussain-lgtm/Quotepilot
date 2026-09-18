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
      <div className="divide-y divide-stone-100 rounded-md border border-stone-200 text-sm">
        <div className="flex items-start gap-3 px-3 py-2">
          <span className="w-16 shrink-0 text-stone-500">To</span>
          {/* Wraps rather than truncates: the whole address must be checkable. */}
          <span className="min-w-0 font-medium text-stone-800 [overflow-wrap:anywhere]">{to}</span>
        </div>
        <div className="flex items-center gap-3 px-3 py-1.5">
          <label htmlFor="quote-subject" className="w-16 shrink-0 text-stone-500">
            Subject
          </label>
          <input
            id="quote-subject"
            className="w-full bg-transparent py-0.5 text-stone-800 focus:outline-none"
            value={subject}
            maxLength={200}
            placeholder={defaultQuoteSubject(businessName, title)}
            onChange={(e) => onSubjectChange(e.target.value)}
          />
        </div>
        <div className="flex items-start gap-3 px-3 py-2">
          <span className="w-16 shrink-0 text-stone-500">From</span>
          <span className="min-w-0 text-stone-700 [overflow-wrap:anywhere]">
            {businessName || "Your business"} via QuoteLoop
            {replyTo ? ` · replies go to ${replyTo}` : ""}
          </span>
        </div>
      </div>

      <textarea
        aria-label="Quote email"
        className="input min-h-[210px] resize-y leading-relaxed"
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
      />

      <div className="rounded-md bg-stone-50 px-3 py-2 text-xs text-stone-600 ring-1 ring-inset ring-stone-200">
        <p>
          <span className="font-medium text-stone-800">{title}</span> ·{" "}
          <span className="num">{formatCurrency(amount, currency)}</span>
          {description ? <span className="text-stone-500"> · {description}</span> : null}
        </p>
        <p className="mt-1 text-stone-500">
          A short line naming your business is added at the end. Nothing is sent until you press Send
          quote email.
        </p>
      </div>
    </div>
  );
}

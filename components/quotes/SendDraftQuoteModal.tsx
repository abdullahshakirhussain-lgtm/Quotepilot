"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { CopyButton } from "@/components/ui/CopyButton";
import { QuoteEmailPreview } from "./QuoteEmailPreview";
import { defaultQuoteBody, defaultQuoteSubject } from "@/lib/quote-email";
import { sendDraftQuoteEmail } from "@/app/(app)/quotes/new-quote-actions";
import type { QuoteWithLead } from "@/lib/types";

/** Sends the quote email for a quote that is still saved as a draft. */
export function SendDraftQuoteModal({
  quote,
  business,
  today,
  onClose,
  onSent,
}: {
  quote: QuoteWithLead;
  business: { name: string; ownerName: string | null; email: string | null };
  /** Viewer's local date from the server. */
  today: string;
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const to = quote.lead?.email?.trim() ?? "";
  const validUntil = quote.valid_until && quote.valid_until >= today ? quote.valid_until : null;

  const [subject, setSubject] = useState(() => defaultQuoteSubject(business.name, quote.title));
  const [body, setBody] = useState(() =>
    defaultQuoteBody({
      customerName: quote.lead?.customer_name ?? "",
      businessName: business.name,
      ownerName: business.ownerName,
      title: quote.title,
      amount: Number(quote.amount),
      currency: quote.currency,
      description: quote.description,
      validUntil,
    })
  );
  const [error, setError] = useState<string | null>(null);
  // An unclear outcome must not offer a second send.
  const [locked, setLocked] = useState(false);
  const [busy, startAction] = useTransition();

  function send() {
    // A second press must never start a second send.
    if (busy || locked) return;
    setError(null);
    startAction(async () => {
      try {
        const outcome = await sendDraftQuoteEmail({ quoteId: quote.id, subject, message: body });
        if (!outcome.ok) {
          if (outcome.unconfirmed || outcome.locked) setLocked(true);
          setError(outcome.error);
          return;
        }
        onSent("Quote email sent. Follow-up reminders are scheduled.");
        onClose();
      } catch (e) {
        unstable_rethrow(e); // e.g. the session expired: let Next redirect to login
        setLocked(true);
        setError(
          "We couldn't confirm whether the quote email was sent. Check this quote before trying again."
        );
      }
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Send quote email"
      description={`To ${quote.lead?.customer_name ?? "your customer"}. Reminders start once it's sent.`}
    >
      <div className="flex flex-col gap-4">
        <QuoteEmailPreview
          to={to}
          subject={subject}
          onSubjectChange={setSubject}
          body={body}
          onBodyChange={setBody}
          title={quote.title}
          amount={Number(quote.amount)}
          currency={quote.currency}
          description={quote.description}
          businessName={business.name}
          replyTo={business.email}
        />

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-inset ring-red-200">
            {error}
            {locked && (
              <div className="mt-2">
                <CopyButton text={body} label="Copy email" className="btn-secondary" />
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-accent"
            onClick={send}
            disabled={busy || locked || !body.trim()}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Sending…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Send quote email
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

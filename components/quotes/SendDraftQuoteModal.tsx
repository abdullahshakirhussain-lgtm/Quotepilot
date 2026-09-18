"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { CopyButton } from "@/components/ui/CopyButton";
import { AddBusinessEmailButton } from "@/components/ui/AddBusinessEmailButton";
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
  // The customer's saved address, or the newer one the server reported.
  const [recipientOverride, setRecipientOverride] = useState<string | null>(null);
  const to = recipientOverride ?? quote.lead?.email?.trim() ?? "";
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
  // The "add a business email first" refusal, so its way out shows only under it.
  const [businessEmailError, setBusinessEmailError] = useState<string | null>(null);
  // Set once the email text or subject is changed, so closing by accident asks first.
  const [edited, setEdited] = useState(false);
  // An unclear outcome must not offer a second send.
  const [locked, setLocked] = useState(false);
  const [busy, startAction] = useTransition();

  function send() {
    // A second press must never start a second send.
    if (busy || locked) return;
    if (body.trim().length > 10_000) {
      return setError("This email is too long to send. Keep it under 10,000 characters.");
    }
    setError(null);
    startAction(async () => {
      try {
        // The address shown is only used to refuse if it changed; the server
        // always sends to the customer's saved address.
        const outcome = await sendDraftQuoteEmail({ quoteId: quote.id, subject, message: body, expectedTo: to });
        if (!outcome.ok) {
          if (outcome.unconfirmed || outcome.locked) setLocked(true);
          if (outcome.recipientChanged) setRecipientOverride(outcome.recipientChanged);
          if (outcome.needsBusinessEmail) setBusinessEmailError(outcome.error);
          setError(outcome.error);
          return;
        }
        onSent("Quote email sent. Follow-up reminders are scheduled.");
        onClose();
      } catch (e) {
        unstable_rethrow(e); // a redirect Next is handling itself must not be swallowed
        setLocked(true);
        setError(
          "We couldn't confirm whether the quote email was sent. Check this quote before trying again."
        );
      }
    });
  }

  // Closing mid-send would hide whether the email went out; edits ask first.
  function requestClose() {
    if (busy) return;
    if (edited && !locked && !window.confirm("Close without sending? Your changes to the email won't be kept.")) return;
    onClose();
  }

  return (
    <Modal
      open
      onClose={requestClose}
      size="lg"
      title="Send quote email"
      description={`To ${quote.lead?.customer_name ?? "your customer"}. Reminders start once it's sent.`}
    >
      <div className="flex flex-col gap-4">
        <QuoteEmailPreview
          to={to}
          subject={subject}
          onSubjectChange={(value) => {
            setSubject(value);
            setEdited(true);
          }}
          body={body}
          onBodyChange={(value) => {
            setBody(value);
            setEdited(true);
          }}
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
            {error === businessEmailError && (
              <div className="mt-2">
                <AddBusinessEmailButton unsaved={edited} />
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
          <button type="button" className="btn-ghost" onClick={requestClose} disabled={busy}>
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

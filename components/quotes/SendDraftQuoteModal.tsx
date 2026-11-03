"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { CopyButton } from "@/components/ui/CopyButton";
import { AddBusinessEmailButton } from "@/components/ui/AddBusinessEmailButton";
import { QuoteEmailPreview } from "./QuoteEmailPreview";
import { composeQuoteEmail } from "@/lib/quote-email";
import type { ResolvedTemplate } from "@/lib/templates";
import type { QuoteBusiness } from "./NewQuoteModal";
import { TemplatePicker } from "@/components/templates/TemplatePicker";
import { sendDraftQuoteEmail } from "@/app/(app)/quotes/new-quote-actions";
import type { QuoteWithLead } from "@/lib/types";

/** Sends the quote email for a quote that is still saved as a draft. */
export function SendDraftQuoteModal({
  quote,
  business,
  templates = [],
  defaultTemplateId = "quote_standard",
  today,
  onClose,
  onSent,
}: {
  quote: QuoteWithLead;
  business: QuoteBusiness;
  /** Quote email templates: ready-made (with the user's edits), then their own. */
  templates?: ResolvedTemplate[];
  /** The template new quote emails start from. */
  defaultTemplateId?: string;
  /** Viewer's local date from the server. */
  today: string;
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  // The customer's saved address, or the newer one the server reported.
  const [recipientOverride, setRecipientOverride] = useState<string | null>(null);
  const to = recipientOverride ?? quote.lead?.email?.trim() ?? "";
  const validUntil = quote.valid_until && quote.valid_until >= today ? quote.valid_until : null;

  // The template the email is written from.
  const [templateId, setTemplateId] = useState(defaultTemplateId);
  const compose = (id: string) =>
    composeQuoteEmail(
      {
        customerName: quote.lead?.customer_name ?? "",
        businessName: business.name,
        ownerName: business.ownerName,
        title: quote.title,
        amount: Number(quote.amount),
        currency: quote.currency,
        description: quote.description,
        validUntil,
        quoteDate: today,
        signOff: business.signOff,
        signature: business.signature,
      },
      templates.find((t) => t.id === id) ?? null
    );
  const [subject, setSubject] = useState(() => compose(templateId).subject);
  const [body, setBody] = useState(() => compose(templateId).body);
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
  const [confirm, confirmDialog] = useConfirm();

  async function pickTemplate(t: ResolvedTemplate) {
    if (
      edited &&
      !(await confirm({
        title: "Replace your edited email?",
        message: "The email is rewritten with the wording you picked. Your edits to it won't be kept.",
        confirmLabel: "Replace email",
        cancelLabel: "Keep my edits",
      }))
    )
      return;
    const email = compose(t.id);
    setTemplateId(t.id);
    setSubject(email.subject);
    setBody(email.body);
    setEdited(false);
    setError(null);
  }
  async function requestClose() {
    if (busy) return;
    if (
      edited &&
      !locked &&
      !(await confirm({
        title: "Close without sending?",
        message: "Your changes to the email won't be kept.",
        confirmLabel: "Discard changes",
        cancelLabel: "Keep editing",
        danger: true,
      }))
    )
      return;
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
        <TemplatePicker
          templates={templates}
          selectedId={templateId}
          onPick={pickTemplate}
          disabled={busy || locked}
        />
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
          <div className="msg-error">
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
      {confirmDialog}
    </Modal>
  );
}

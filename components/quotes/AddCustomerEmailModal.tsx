"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { addCustomerEmail } from "@/app/(app)/quotes/new-quote-actions";

/**
 * Saves an email address on a customer who has none, so a draft quote can be
 * sent from QuoteLoop. The saved address is what the server later sends to —
 * the browser never supplies the recipient at send time.
 */
export function AddCustomerEmailModal({
  customerId,
  customerName,
  onClose,
  onSaved,
}: {
  customerId: string;
  customerName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function save() {
    // Enter pressed again while saving must not save twice.
    if (busy) return;
    setError(null);
    start(async () => {
      try {
        const outcome = await addCustomerEmail(customerId, email.trim());
        if (!outcome.ok) return setError(outcome.error);
        onSaved();
      } catch (e) {
        unstable_rethrow(e); // a redirect Next is handling itself must not be swallowed
        setError(
          "QuoteLoop couldn't be reached, so the email address may not have been saved. You may have lost your connection, or been signed out in another tab — refresh the page and try again."
        );
      }
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add customer email"
      description={`Save an email address for ${customerName} so QuoteLoop can send this quote.`}
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="add-email">
            Email address
          </label>
          <input
            id="add-email"
            type="email"
            autoFocus
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="name@example.com"
          />
          <p className="mt-1 text-xs text-stone-500">
            It is saved to this customer, so future follow-ups can be emailed too.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-inset ring-red-200">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-stone-200 pt-4">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={busy || !email.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Save and continue
          </button>
        </div>
      </div>
    </Modal>
  );
}

"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { CURRENCIES } from "@/lib/constants";
import type { Lead, Quote } from "@/lib/types";
import { updateQuote, type QuoteActionState } from "@/app/(app)/quotes/actions";
import { reportUnreachable } from "@/lib/form-action";

const saveQuote = reportUnreachable(updateQuote);

type CustomerOption = Pick<Lead, "id" | "customer_name" | "company_name">;

function Disclosure({
  label,
  defaultOpen,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group" open={defaultOpen}>
      <summary className="tap inline-flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-stone-500 hover:text-stone-900 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
        {label}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

/** Edits an existing quote. New quotes go through NewQuoteModal. */
export function QuoteFormModal({
  quote,
  leads,
  defaultCurrency,
  today,
  onClose,
  onSaved,
}: {
  quote: Quote;
  leads: CustomerOption[];
  defaultCurrency: string;
  /** Viewer's local date from the server. */
  today: string;
  onClose: () => void;
  onSaved?: (message: string) => void;
}) {
  const [state, formAction, pending] = useActionState<QuoteActionState, FormData>(saveQuote, {});
  const done = useRef(false);
  // Set once anything is changed, so closing by accident asks first.
  const dirty = useRef(false);

  useEffect(() => {
    if (state.ok && !done.current) {
      done.current = true;
      onSaved?.(state.message ?? "Saved.");
      onClose();
    }
  }, [state.ok, state.message, onSaved, onClose]);

  function requestClose() {
    if (pending) return;
    if (dirty.current && !window.confirm("Close without saving your changes to this quote?")) return;
    onClose();
  }

  const hasMoreDetails = Boolean(quote.description || quote.valid_until || quote.notes);

  return (
    <Modal
      open
      onClose={requestClose}
      size="lg"
      title="Edit quote"
      description="Won, lost and follow-ups are handled from the quote card."
    >
      {/* Submitted by hand rather than with <form action>: React resets a form
          after its action runs, which would wipe the user's edits whenever the
          server answers with a problem to fix. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return;
          const data = new FormData(e.currentTarget);
          startTransition(() => formAction(data));
        }}
        onInput={() => {
          dirty.current = true;
        }}
        className="flex flex-col gap-6"
      >
        <section>
          <span className="eyebrow">Customer</span>
          <select
            name="lead_id"
            required
            aria-label="Customer"
            className="input mt-2"
            defaultValue={quote.lead_id}
          >
            <option value="" disabled>
              Choose a customer…
            </option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.customer_name}
                {l.company_name ? ` — ${l.company_name}` : ""}
              </option>
            ))}
          </select>
        </section>

        <section className="space-y-3">
          <span className="eyebrow">Quote</span>
          <div>
            <label className="label" htmlFor="title">
              What did you quote for?
            </label>
            <input id="title" name="title" required maxLength={200} className="input" defaultValue={quote.title} />
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_7rem_10rem]">
            <div>
              <label className="label" htmlFor="amount">
                Amount
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                required
                inputMode="decimal"
                className="input num"
                defaultValue={quote.amount}
              />
            </div>
            <div>
              <label className="label" htmlFor="currency">
                Currency
              </label>
              <select id="currency" name="currency" className="input" defaultValue={quote.currency ?? defaultCurrency}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="quote_date">
                Sent date
              </label>
              <input
                id="quote_date"
                name="quote_date"
                type="date"
                max={quote.status === "draft" ? undefined : today}
                className="input"
                defaultValue={quote.quote_date ?? today}
              />
            </div>
          </div>
          {quote.status !== "draft" && quote.status !== "accepted" && quote.status !== "rejected" && quote.status !== "expired" && (
            <p className="text-xs text-stone-500">
              Changing the sent date moves this quote&apos;s upcoming follow-up reminders with it.
            </p>
          )}

          <Disclosure label="More details (optional)" defaultOpen={hasMoreDetails}>
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="description">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={2}
                  className="input"
                  defaultValue={quote.description ?? ""}
                  placeholder="Scope of work. Helps the AI write a better follow-up."
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="valid_until">
                    Valid until
                  </label>
                  <input
                    id="valid_until"
                    name="valid_until"
                    type="date"
                    className="input"
                    defaultValue={quote.valid_until ?? ""}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="notes">
                    Internal notes
                  </label>
                  {/* A textarea, so line breaks in the notes survive an edit. */}
                  <textarea
                    id="notes"
                    name="notes"
                    rows={2}
                    className="input"
                    defaultValue={quote.notes ?? ""}
                    placeholder="Only you see these"
                  />
                </div>
              </div>
            </div>
          </Disclosure>
        </section>

        {state.error && (
          <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-inset ring-red-200">
            {state.error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-200 pt-4">
          <button type="button" className="btn-ghost" onClick={requestClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </button>
        </div>
        <input type="hidden" name="id" value={quote.id} />
      </form>
    </Modal>
  );
}

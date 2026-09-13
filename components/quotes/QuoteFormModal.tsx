"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ChevronRight, Loader2, Send } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { CURRENCIES } from "@/lib/constants";
import type { Lead, Quote } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  createQuote,
  updateQuote,
  type QuoteActionState,
} from "@/app/(app)/quotes/actions";

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
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-stone-500 hover:text-stone-900 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
        {label}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

export function QuoteFormModal({
  quote,
  leads,
  defaultCurrency,
  today,
  preselectLeadId,
  onClose,
  onSaved,
}: {
  quote?: Quote | null;
  leads: CustomerOption[];
  defaultCurrency: string;
  /** Viewer's local date from the server, used as the default quote date. */
  today: string;
  preselectLeadId?: string;
  onClose: () => void;
  onSaved?: (message: string) => void;
}) {
  const isEdit = Boolean(quote);
  const [state, formAction, pending] = useActionState<QuoteActionState, FormData>(
    isEdit ? updateQuote : createQuote,
    {}
  );
  const [mode, setMode] = useState<"new" | "existing">(
    preselectLeadId && leads.some((l) => l.id === preselectLeadId) ? "existing" : "new"
  );
  const intentRef = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    if (state.ok && !done.current) {
      done.current = true;
      onSaved?.(state.message ?? "Saved.");
      onClose();
    }
  }, [state.ok, state.message, onSaved, onClose]);

  const hasMoreDetails = Boolean(quote?.description || quote?.valid_until || quote?.notes);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isEdit ? "Edit quote" : "New quote"}
      description={
        isEdit
          ? "Status changes from the quote card: Mark sent, Won or Lost."
          : "Who it's for and what you quoted. Everything else is optional."
      }
    >
      {/* flex+gap, not space-y: React injects hidden action inputs first. */}
      <form action={formAction} className="flex flex-col gap-6">
        {/* Customer */}
        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="eyebrow">Customer</span>
            {!isEdit && leads.length > 0 && (
              <div className="inline-flex rounded-md border border-stone-300 p-0.5 text-xs font-medium">
                {(["new", "existing"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={cn(
                      "rounded px-2.5 py-1 transition-colors",
                      mode === m ? "bg-stone-900 text-white" : "text-stone-600 hover:text-stone-900"
                    )}
                  >
                    {m === "new" ? "New customer" : "Existing customer"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isEdit || mode === "existing" ? (
            <select
              name="lead_id"
              required
              aria-label="Customer"
              className="input"
              defaultValue={quote?.lead_id ?? preselectLeadId ?? ""}
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
          ) : (
            <div className="space-y-3">
              <input
                name="customer_name"
                required
                autoFocus
                aria-label="Customer name"
                className="input"
                placeholder="Customer name"
              />
              <Disclosure label="Add contact details (optional)">
                <div className="grid gap-3 sm:grid-cols-3">
                  <input name="company_name" aria-label="Company" className="input" placeholder="Company" />
                  <input name="email" type="email" aria-label="Email" className="input" placeholder="Email" />
                  <input name="phone" aria-label="Phone" className="input" placeholder="Phone" />
                </div>
                <p className="mt-2 text-xs text-stone-500">
                  If a customer with this email or phone already exists, the quote is added to them.
                </p>
              </Disclosure>
            </div>
          )}
        </section>

        {/* Quote */}
        <section className="space-y-3">
          <span className="eyebrow">Quote</span>
          <div>
            <label className="label" htmlFor="title">What did you quote for?</label>
            <input
              id="title"
              name="title"
              required
              className="input"
              defaultValue={quote?.title ?? ""}
              placeholder="e.g. Service 3 split-system AC units"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_7rem_10rem]">
            <div>
              <label className="label" htmlFor="amount">Amount</label>
              <input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                required
                inputMode="decimal"
                className="input num"
                defaultValue={quote?.amount ?? ""}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="label" htmlFor="currency">Currency</label>
              <select
                id="currency"
                name="currency"
                className="input"
                defaultValue={quote?.currency ?? defaultCurrency}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="quote_date">Quote date</label>
              <input
                id="quote_date"
                name="quote_date"
                type="date"
                className="input"
                defaultValue={quote?.quote_date ?? today}
              />
            </div>
          </div>

          <Disclosure label="More details (optional)" defaultOpen={hasMoreDetails}>
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  rows={2}
                  className="input"
                  defaultValue={quote?.description ?? ""}
                  placeholder="Scope of work. Helps the AI write a better follow-up."
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="valid_until">Valid until</label>
                  <input
                    id="valid_until"
                    name="valid_until"
                    type="date"
                    className="input"
                    defaultValue={quote?.valid_until ?? ""}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="notes">Internal notes</label>
                  <input
                    id="notes"
                    name="notes"
                    className="input"
                    defaultValue={quote?.notes ?? ""}
                    placeholder="Only you see these"
                  />
                </div>
              </div>
            </div>
          </Disclosure>
        </section>

        {state.error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-inset ring-red-200">
            {state.error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
          {isEdit ? (
            <>
              <button type="button" className="btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save changes
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-stone-500">
                Marking it sent schedules your follow-up reminders.
              </p>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="btn-secondary"
                  disabled={pending}
                  onClick={() => {
                    if (intentRef.current) intentRef.current.value = "draft";
                  }}
                >
                  Save draft
                </button>
                <button
                  type="submit"
                  className="btn-accent"
                  disabled={pending}
                  onClick={() => {
                    if (intentRef.current) intentRef.current.value = "sent";
                  }}
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Save &amp; mark sent
                </button>
              </div>
            </>
          )}
        </div>
        {/* Hidden fields go last so they don't add to the form's spacing. */}
        {isEdit && <input type="hidden" name="id" value={quote!.id} />}
        {!isEdit && <input type="hidden" name="customer_mode" value={mode} />}
        <input ref={intentRef} type="hidden" name="intent" defaultValue="draft" />
      </form>
    </Modal>
  );
}

"use client";

import { useActionState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
  CURRENCIES,
  QUOTE_STATUSES,
  QUOTE_STATUS_LABELS,
} from "@/lib/constants";
import type { Lead, Quote } from "@/lib/types";
import { todayISO } from "@/lib/utils";
import {
  createQuote,
  updateQuote,
  type QuoteActionState,
} from "@/app/(app)/quotes/actions";

export function QuoteFormModal({
  quote,
  leads,
  defaultCurrency,
  preselectLeadId,
  onClose,
}: {
  quote?: Quote | null;
  leads: Pick<Lead, "id" | "customer_name" | "company_name">[];
  defaultCurrency: string;
  preselectLeadId?: string;
  onClose: () => void;
}) {
  const isEdit = Boolean(quote);
  const action = isEdit ? updateQuote : createQuote;
  const [state, formAction, pending] = useActionState<QuoteActionState, FormData>(
    action,
    {}
  );

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isEdit ? "Edit quote" : "New quote"}
      description="A quote always belongs to a lead."
    >
      <form action={formAction} className="space-y-4">
        {isEdit && <input type="hidden" name="id" value={quote!.id} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="lead_id">
              Lead *
            </label>
            <select
              id="lead_id"
              name="lead_id"
              required
              className="input"
              defaultValue={quote?.lead_id ?? preselectLeadId ?? ""}
            >
              <option value="" disabled>
                Select a lead…
              </option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.customer_name}
                  {l.company_name ? ` — ${l.company_name}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="title">
              Quote title *
            </label>
            <input
              id="title"
              name="title"
              required
              className="input"
              defaultValue={quote?.title ?? ""}
              placeholder="e.g. Servicing of 3 split-system AC units"
            />
          </div>

          <div>
            <label className="label" htmlFor="amount">
              Amount *
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0"
              required
              className="input"
              defaultValue={quote?.amount ?? ""}
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="label" htmlFor="currency">
              Currency *
            </label>
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
            <label className="label" htmlFor="quote_date">
              Quote date
            </label>
            <input
              id="quote_date"
              name="quote_date"
              type="date"
              className="input"
              defaultValue={quote?.quote_date ?? todayISO()}
            />
          </div>

          <div>
            <label className="label" htmlFor="valid_until">
              Valid until (optional)
            </label>
            <input
              id="valid_until"
              name="valid_until"
              type="date"
              className="input"
              defaultValue={quote?.valid_until ?? ""}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              className="input"
              defaultValue={quote?.status ?? "draft"}
            >
              {QUOTE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {QUOTE_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Changing a quote to “Sent” schedules its follow-up reminders.
              Accepted, Rejected or Expired closes any pending ones.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="description">
              Description (optional)
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              className="input"
              defaultValue={quote?.description ?? ""}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="notes">
              Internal notes (optional)
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              className="input"
              defaultValue={quote?.notes ?? ""}
            />
          </div>
        </div>

        {state.error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create quote"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

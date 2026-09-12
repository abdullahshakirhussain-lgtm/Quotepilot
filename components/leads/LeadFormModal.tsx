"use client";

import { useActionState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/constants";
import type { Lead } from "@/lib/types";
import {
  createLead,
  updateLead,
  type LeadActionState,
} from "@/app/(app)/leads/actions";

export function LeadFormModal({
  lead,
  onClose,
}: {
  lead?: Lead | null;
  onClose: () => void;
}) {
  const isEdit = Boolean(lead);
  const action = isEdit ? updateLead : createLead;
  const [state, formAction, pending] = useActionState<LeadActionState, FormData>(
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
      title={isEdit ? "Edit lead" : "Add lead"}
      description="Track a potential customer and their details."
    >
      <form action={formAction} className="space-y-4">
        {isEdit && <input type="hidden" name="id" value={lead!.id} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="customer_name">
              Customer name *
            </label>
            <input
              id="customer_name"
              name="customer_name"
              required
              className="input"
              defaultValue={lead?.customer_name ?? ""}
              placeholder="e.g. Marcus Reed"
            />
          </div>
          <div>
            <label className="label" htmlFor="company_name">
              Company (optional)
            </label>
            <input
              id="company_name"
              name="company_name"
              className="input"
              defaultValue={lead?.company_name ?? ""}
            />
          </div>
          <div>
            <label className="label" htmlFor="source">
              Source (optional)
            </label>
            <input
              id="source"
              name="source"
              className="input"
              defaultValue={lead?.source ?? ""}
              placeholder="Referral, Google, walk-in…"
            />
          </div>
          <div>
            <label className="label" htmlFor="phone">
              Phone (optional)
            </label>
            <input
              id="phone"
              name="phone"
              className="input"
              defaultValue={lead?.phone ?? ""}
            />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email (optional)
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="input"
              defaultValue={lead?.email ?? ""}
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
              defaultValue={lead?.status ?? "new"}
            >
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="notes">
              Notes (optional)
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="input"
              defaultValue={lead?.notes ?? ""}
              placeholder="What do they need? Any context worth remembering."
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
            {isEdit ? "Save changes" : "Add lead"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

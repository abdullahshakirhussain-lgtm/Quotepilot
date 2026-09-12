"use client";

import { useTransition } from "react";
import { GripVertical } from "lucide-react";
import {
  LEAD_STATUS_LABELS,
  PIPELINE_COLUMNS,
  LEAD_STATUSES,
  type LeadStatus,
} from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { setLeadStatus } from "@/app/(app)/leads/actions";

export interface PipelineLead {
  id: string;
  customer_name: string;
  company_name: string | null;
  status: LeadStatus;
  quoteTotal: number;
  currency: string;
}

export function PipelineClient({ leads }: { leads: PipelineLead[] }) {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Pipeline</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your leads grouped by stage. Use the menu on a card to move it.
        </p>
      </header>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_COLUMNS.map((col) => {
          const items = leads.filter((l) => l.status === col);
          const colTotal = items.reduce((s, l) => s + l.quoteTotal, 0);
          const currency = items[0]?.currency ?? "USD";
          return (
            <div key={col} className="w-72 shrink-0">
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-slate-700">
                  {LEAD_STATUS_LABELS[col]}
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                  {items.length}
                </span>
              </div>
              <div className="min-h-[120px] space-y-2 rounded-xl bg-slate-100/70 p-2">
                {items.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-slate-400">
                    Nothing here
                  </p>
                ) : (
                  items.map((l) => <PipelineCard key={l.id} lead={l} />)
                )}
                {colTotal > 0 && (
                  <div className="px-2 pt-1 text-right text-xs text-slate-400">
                    {formatCurrency(colTotal, currency)} quoted
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PipelineCard({ lead }: { lead: PipelineLead }) {
  const [pending, start] = useTransition();
  return (
    <div className="card p-3">
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-slate-900">
            {lead.customer_name}
          </div>
          {lead.company_name && (
            <div className="truncate text-xs text-slate-500">
              {lead.company_name}
            </div>
          )}
          {lead.quoteTotal > 0 && (
            <div className="mt-1 text-xs font-medium text-slate-600">
              {formatCurrency(lead.quoteTotal, lead.currency)}
            </div>
          )}
        </div>
      </div>
      <select
        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
        value={lead.status}
        disabled={pending}
        onChange={(e) =>
          start(async () =>
            await setLeadStatus(lead.id, e.target.value as LeadStatus)
          )
        }
      >
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>
            Move to: {LEAD_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  LEAD_STATUS_LABELS,
  PIPELINE_COLUMNS,
  LEAD_STATUSES,
  type LeadStatus,
} from "@/lib/constants";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils";
import { combineMoney, formatMoney, type Money } from "@/lib/metrics";
import { setLeadStatus } from "@/app/(app)/leads/actions";

export interface PipelineLead {
  id: string;
  customer_name: string;
  company_name: string | null;
  status: LeadStatus;
  /** The customer's quotes added up per currency. */
  quoteTotals: Money[];
}

const COLUMN_ACCENT: Partial<Record<LeadStatus, string>> = {
  follow_up_due: "text-brand-700",
  won: "text-emerald-700",
  lost: "text-red-700",
};

export function PipelineClient({ leads, currency }: { leads: PipelineLead[]; currency: string }) {
  const coldCount = leads.filter((l) => l.status === "cold").length;

  return (
    <div>
      <PageHeader
        title="Pipeline"
        subtitle={
          <>
            Every customer by stage. Won and Lost update automatically from your quotes.
            {coldCount > 0 && (
              <>
                {" "}
                {coldCount} cold {coldCount === 1 ? "customer is" : "customers are"} hidden —{" "}
                <a href="/leads" className="font-medium text-stone-700 underline-offset-2 hover:underline">
                  see Customers
                </a>
                .
              </>
            )}
          </>
        }
      />

      {/* All seven stages fit side by side on a laptop screen; narrower screens scroll. */}
      <div className="overflow-x-auto pb-4">
        <div className="grid min-w-[62rem] grid-cols-7 gap-2">
          {PIPELINE_COLUMNS.map((col) => {
            const items = leads.filter((l) => l.status === col);
            const colTotal = combineMoney(
              items.map((l) => l.quoteTotals),
              currency
            ).filter((m) => m.amount > 0);
            return (
              <div key={col} className="min-w-0">
                <div className="mb-2 px-1">
                  <h2 className={cn("truncate text-[13px] font-semibold text-stone-800", COLUMN_ACCENT[col])}>
                    {LEAD_STATUS_LABELS[col]}
                    <span className="num ml-1 text-xs font-medium text-stone-400">{items.length}</span>
                  </h2>
                  <p className="num min-h-4 break-words text-xs text-stone-500">
                    {colTotal.length ? formatMoney(colTotal, currency) : ""}
                  </p>
                </div>
                <div className="min-h-[140px] space-y-2 rounded-lg bg-stone-900/[0.03] p-1.5 ring-1 ring-inset ring-stone-200">
                  {items.length === 0 ? (
                    <p className="px-2 py-8 text-center text-xs text-stone-400">None</p>
                  ) : (
                    items.map((l) => <PipelineCard key={l.id} lead={l} currency={currency} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PipelineCard({ lead, currency }: { lead: PipelineLead; currency: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const totals = lead.quoteTotals.filter((m) => m.amount > 0);
  return (
    <div className="rounded-md border border-stone-200 bg-white p-2.5">
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-stone-900">{lead.customer_name}</div>
          {lead.company_name && (
            <div className="truncate text-xs text-stone-500">{lead.company_name}</div>
          )}
        </div>
        {pending && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-stone-400" />}
      </div>
      {totals.length > 0 && (
        <div className="num mt-1 break-words text-sm font-semibold text-stone-800">
          {formatMoney(totals, currency)}
        </div>
      )}
      <select
        aria-label={`Move ${lead.customer_name} to another stage`}
        title="Move to another stage"
        className="tap mt-2 w-full rounded border border-stone-200 bg-stone-50 px-1 py-1 text-xs text-stone-600 focus:border-stone-400 focus:outline-none"
        value={lead.status}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as LeadStatus;
          start(async () => {
            setError(null);
            try {
              const result = await setLeadStatus(lead.id, next);
              if (!result.ok) setError(result.error);
            } catch (err) {
              unstable_rethrow(err); // a redirect Next is handling itself must not be swallowed
              setError("That didn't go through. Refresh the page and try again.");
            }
          });
        }}
      >
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>
            {LEAD_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

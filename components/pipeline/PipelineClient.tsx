"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import { LEAD_STATUS_LABELS, PIPELINE_COLUMNS, LEAD_STATUSES, type LeadStatus } from "@/lib/constants";
import { PageHeader } from "@/components/ui/PageHeader";
import { Menu, MenuItem, MenuLabel } from "@/components/ui/Menu";
import { cn } from "@/lib/utils";
import { combineMoney, formatMoney, type Money } from "@/lib/metrics";
import { setLeadStatus } from "@/app/(app)/leads/actions";

export interface PipelineLead {
  id: string;
  customer_name: string;
  company_name: string | null;
  status: LeadStatus;
  /** The customer's quotes for this stage, added up per currency. */
  quoteTotals: Money[];
  /** Open quotes of a won, lost or cold customer, which no column counts. */
  stillOpen?: Money[];
}

/** A count chip per stage: colour only where it means something. */
const CHIP: Partial<Record<LeadStatus, string>> = {
  follow_up_due: "chip-today",
  won: "chip-won",
};

function StageHeading({ col, count, total }: { col: LeadStatus; count: number; total: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
      <h2 className="flex items-center gap-2 text-[15px] font-medium text-stone-900">
        {LEAD_STATUS_LABELS[col]}
        <span className={cn("num", CHIP[col] ?? "chip-muted")}>{count}</span>
      </h2>
      {total && <span className="num text-[13px] text-stone-500 [overflow-wrap:anywhere]">{total}</span>}
    </div>
  );
}

export function PipelineClient({ leads, currency }: { leads: PipelineLead[]; currency: string }) {
  const coldCount = leads.filter((l) => l.status === "cold").length;
  const columns = PIPELINE_COLUMNS.map((col) => {
    const items = leads.filter((l) => l.status === col);
    const total = combineMoney(
      items.map((l) => l.quoteTotals),
      currency
    ).filter((m) => m.amount > 0);
    return { col, items, total: total.length ? formatMoney(total, currency) : "" };
  });
  const filled = columns.filter((c) => c.items.length > 0);
  const empty = columns.filter((c) => c.items.length === 0);

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
                {coldCount} cold {coldCount === 1 ? "customer is" : "customers are"} hidden here; they&apos;re listed in{" "}
                <a href="/leads" className="font-medium text-info-700 hover:underline">
                  Customers
                </a>
                .
              </>
            )}
          </>
        }
      />

      {/* Up to large desktop screens: the stages that have customers, one
          under another. A sideways board on a narrow screen opens on empty
          columns and hides the customers off to the right. */}
      <div className="flex flex-col gap-4 2xl:hidden">
        {filled.length === 0 ? (
          <p className="card px-5 py-6 text-[14px] text-stone-500">
            No customers yet. They appear here when you add a quote.
          </p>
        ) : (
          filled.map(({ col, items, total }) => (
            <section key={col} className="card">
              <div className="border-b border-[#ECEEF1] px-4 py-3 sm:px-5">
                <StageHeading col={col} count={items.length} total={total} />
              </div>
              <ul className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4">
                {items.map((l, i) => (
                  <PipelineCard key={l.id} lead={l} currency={currency} index={i} className="rounded-[10px] border border-line" />
                ))}
              </ul>
            </section>
          ))
        )}
        {filled.length > 0 && empty.length > 0 && (
          <p className="text-[14px] text-stone-500">
            No customers in: {empty.map((c) => LEAD_STATUS_LABELS[c.col]).join(", ")}
          </p>
        )}
      </div>

      {/* Wide screens: all seven stages side by side, every one in full view. */}
      <div className="hidden grid-cols-7 gap-3 2xl:grid">
        {columns.map(({ col, items, total }, ci) => (
          <section key={col} className="flex min-w-0 flex-col gap-2.5 rounded-[12px] bg-stone-100/70 p-2.5">
            <div className="px-1 pt-0.5">
              <StageHeading col={col} count={items.length} total={total} />
            </div>
            {items.length === 0 ? (
              <p className="px-1 pb-2 text-[13px] text-stone-400">None</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {items.map((l, i) => (
                  <PipelineCard key={l.id} lead={l} currency={currency} index={ci + i} alignMenu={ci >= 4 ? "right" : "left"} className="card" />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function PipelineCard({
  lead,
  currency,
  index,
  alignMenu = "left",
  className,
}: {
  lead: PipelineLead;
  currency: string;
  index: number;
  alignMenu?: "left" | "right";
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const totals = lead.quoteTotals.filter((m) => m.amount > 0);
  const stillOpen = (lead.stillOpen ?? []).filter((m) => m.amount > 0);

  const move = (next: LeadStatus) =>
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

  return (
    <li data-pipeline-card className={cn("ql-in bg-white p-3", className)} style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}>
      <div className="text-[14px] font-medium leading-snug text-stone-900 [overflow-wrap:anywhere]">{lead.customer_name}</div>
      {lead.company_name && <div className="text-[12px] text-stone-500 [overflow-wrap:anywhere]">{lead.company_name}</div>}
      {totals.length > 0 && (
        <div className="num mt-1.5 text-[16px] font-semibold leading-tight text-stone-900 [overflow-wrap:anywhere]">
          {formatMoney(totals, currency)}
        </div>
      )}
      {stillOpen.length > 0 && (
        <div className="num mt-0.5 text-[12px] text-stone-500 [overflow-wrap:anywhere]">
          plus {formatMoney(stillOpen, currency)} still open
        </div>
      )}
      <div className="mt-1.5 flex items-center gap-2">
        <Menu
          label={`Move ${lead.customer_name} to another stage`}
          align={alignMenu}
          triggerClassName="tap -ml-1 inline-flex items-center gap-1 rounded-[6px] px-1 py-0.5 text-[13px] font-medium text-info-700 transition-colors hover:bg-info-50 disabled:opacity-50"
          trigger={
            <>
              <span className="sr-only">{lead.customer_name}: </span>Move to <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </>
          }
        >
          <MenuLabel>Move to stage</MenuLabel>
          {LEAD_STATUSES.filter((s) => s !== lead.status).map((s) => (
            <MenuItem key={s} disabled={pending} onClick={() => move(s)}>
              {LEAD_STATUS_LABELS[s]}
            </MenuItem>
          ))}
        </Menu>
        {pending && <Loader2 className="h-4 w-4 animate-spin text-stone-500" aria-label="Moving" />}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-[13px] font-medium text-red-700">
          {error}
        </p>
      )}
    </li>
  );
}

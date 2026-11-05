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
import { CustomerViews } from "@/components/Sidebar";

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
        actions={<CustomerViews />}
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
              {/* One row per customer, full width: no half-empty grid, no cards in cards. */}
              <ul className="divide-y divide-[#ECEEF1]">
                {items.map((l) => (
                  <PipelineCard key={l.id} lead={l} currency={currency} row />
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
                {items.map((l) => (
                  <PipelineCard key={l.id} lead={l} currency={currency} alignMenu={ci >= 4 ? "right" : "left"} className="card p-3" />
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
  alignMenu = "left",
  row = false,
  className,
}: {
  lead: PipelineLead;
  currency: string;
  alignMenu?: "left" | "right";
  /** A full-width list row (who on the left, the amount on the right) instead of a board card. */
  row?: boolean;
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

  const amount = totals.length > 0 && (
    <div className={cn("num font-semibold leading-tight text-stone-900 [overflow-wrap:anywhere]", row ? "text-right text-[15px]" : "mt-1.5 text-[16px]")}>
      {formatMoney(totals, currency)}
    </div>
  );
  const moveMenu = (
    <div className="flex items-center gap-2">
      <Menu
        label={`Move ${lead.customer_name} to another stage`}
        align={row ? "right" : alignMenu}
        triggerClassName="tap -ml-1 inline-flex items-center gap-1 rounded-[6px] px-1 py-0.5 text-[13px] font-medium text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-900 disabled:opacity-50"
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
  );
  const who = (
    <>
      <div className="text-[15px] font-medium leading-snug text-stone-900 [overflow-wrap:anywhere]">{lead.customer_name}</div>
      {lead.company_name && <div className="text-[13px] text-stone-500 [overflow-wrap:anywhere]">{lead.company_name}</div>}
    </>
  );
  const open = stillOpen.length > 0 && (
    <div className="num mt-0.5 text-[13px] text-stone-500 [overflow-wrap:anywhere]">
      plus {formatMoney(stillOpen, currency)} still open
    </div>
  );
  const errorLine = error && (
    <p role="alert" className="mt-1 text-[13px] font-medium text-red-700">
      {error}
    </p>
  );

  // Read in this order: who, how much, then what else and the stage menu.
  if (row) {
    return (
      <li data-pipeline-card className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 px-4 py-3 sm:px-5", className)}>
        <div className="col-start-1 row-start-1 min-w-0">{who}</div>
        {amount && <div className="col-start-2 row-start-1">{amount}</div>}
        <div className="col-span-2 col-start-1 row-start-2 min-w-0">
          {open}
          <div className="mt-1">{moveMenu}</div>
          {errorLine}
        </div>
      </li>
    );
  }
  return (
    <li data-pipeline-card className={cn("bg-white", className)}>
      {who}
      {amount}
      {open}
      <div className="mt-1.5">{moveMenu}</div>
      {errorLine}
    </li>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import Link from "next/link";
import { FilePlus2, Loader2, Mail, Pencil, Plus, Search, Trash2, UserPlus, Users } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { useConfirm, type ConfirmOptions } from "@/components/ui/ConfirmDialog";
import { LeadFormModal } from "./LeadFormModal";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/constants";
import type { ActionResult, Lead } from "@/lib/types";
import { deleteLead } from "@/app/(app)/leads/actions";
import { isSampleAddress } from "@/lib/email-address";
import { SampleBadge, SampleDataBanner } from "@/components/SampleData";
import { CustomerViews } from "@/components/Sidebar";

export function LeadsClient({ leads, startNew = false }: { leads: Lead[]; startNew?: boolean }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [editing, setEditing] = useState<Lead | null>(null);
  const [focusEmail, setFocusEmail] = useState(false);
  const [showNew, setShowNew] = useState(startNew);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (!q) return true;
      return [l.customer_name, l.company_name, l.email, l.phone, l.source]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [leads, query, statusFilter]);

  const deleteOptions = (lead: Lead) => ({
    title: "Delete this customer?",
    message: `Delete ${lead.customer_name}? Their quotes and follow-ups are deleted too. Records of emails QuoteLoop already sent are kept.`,
    confirmLabel: "Delete customer",
    cancelLabel: "Keep customer",
    danger: true,
  });

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Created automatically when you add a quote."
        actions={
          // "New quote" lives in the navigation, once per screen.
          <>
            <CustomerViews />
            <button className="btn-secondary" onClick={() => setShowNew(true)}>
              <UserPlus className="h-4 w-4" /> Add customer
            </button>
          </>
        }
      />

      {leads.some((l) => isSampleAddress(l.email)) && <SampleDataBanner />}

      {leads.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No customers yet"
          description="Customers are created automatically when you create a quote."
          action={
            <Link href="/quotes?new=1" className="btn-primary">
              <Plus className="h-4 w-4" /> New quote
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-3 flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-stone-500" />
              <input
                className="input pl-9"
                placeholder="Search customers"
                aria-label="Search customers"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              className="input tap w-auto shrink-0"
              aria-label="Filter by stage"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "all")}
            >
              <option value="all">All stages</option>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          {deleteError && (
            <div role="alert" className="msg-error mb-3">
              {deleteError}
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="card px-5 py-6 text-[14px] text-stone-500">No customers match your search.</p>
          ) : (
            <>
              {/* Phones: one entry per customer, every action labelled and in view. */}
              <ul className="card divide-y divide-[#ECEEF1] md:hidden">
                {filtered.map((lead, i) => (
                  <li key={lead.id} className="ql-in px-4 py-4" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                          <span className="text-[16px] font-medium leading-snug text-stone-900 [overflow-wrap:anywhere]">
                            {lead.customer_name}
                          </span>
                          {isSampleAddress(lead.email) && <SampleBadge />}
                        </div>
                        {lead.company_name && (
                          <div className="text-[14px] text-stone-500 [overflow-wrap:anywhere]">{lead.company_name}</div>
                        )}
                      </div>
                      <StatusBadge kind="lead" value={lead.status} />
                    </div>
                    <div className="mt-1.5 space-y-0.5 text-[14px] text-stone-600">
                      {lead.email ? (
                        <div className="[overflow-wrap:anywhere]">{lead.email}</div>
                      ) : (
                        <div className="text-stone-600">No email yet</div>
                      )}
                      {lead.phone && <div className="num [overflow-wrap:anywhere]">{lead.phone}</div>}
                      {lead.source && <div className="text-stone-600 [overflow-wrap:anywhere]">Source: {lead.source}</div>}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {!lead.email && (
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            setFocusEmail(true);
                            setEditing(lead);
                          }}
                        >
                          <Mail className="h-4 w-4" /> Add email
                        </button>
                      )}
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          setFocusEmail(false);
                          setEditing(lead);
                        }}
                      >
                        <Pencil className="h-4 w-4" /> Edit
                      </button>
                      <Link href={`/quotes?lead=${lead.id}`} className="btn-secondary">
                        <FilePlus2 className="h-4 w-4" /> New quote
                      </Link>
                      <div className="ml-auto">
                        <MoreActions name={lead.customer_name} confirm={deleteOptions(lead)} onDelete={() => deleteLead(lead.id)} onError={setDeleteError} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Tablets and up: a ruled table, like a ledger page. */}
              {/* relative: keeps the screen-reader-only header label inside this scroll box. */}
              <div className="card ql-fade relative hidden overflow-x-auto md:block">
                <table className="w-full min-w-[720px] text-[14px]">
                  <thead>
                    <tr className="border-b border-[#ECEEF1] text-left text-[13px] text-stone-500">
                      <th className="py-3 pl-5 pr-4 font-medium">Customer</th>
                      <th className="px-4 py-3 font-medium">Contact</th>
                      <th className="px-4 py-3 font-medium">Source</th>
                      <th className="px-4 py-3 font-medium">Stage</th>
                      <th className="py-3 pl-4 pr-5">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECEEF1]">
                    {/* No row-by-row entrance here: on table rows it left them invisible in Chrome. */}
                    {filtered.map((lead) => (
                      <tr key={lead.id} className="transition-colors hover:bg-stone-50">
                        <td className="py-3 pl-5 pr-4 align-top">
                          <div className="flex flex-wrap items-baseline gap-x-2 font-medium text-stone-900 [overflow-wrap:anywhere]">
                            {lead.customer_name}
                            {isSampleAddress(lead.email) && <SampleBadge />}
                          </div>
                          {lead.company_name && (
                            <div className="text-[13px] text-stone-500 [overflow-wrap:anywhere]">{lead.company_name}</div>
                          )}
                          {lead.notes && <div className="mt-0.5 line-clamp-1 max-w-xs text-[14px] text-stone-600">{lead.notes}</div>}
                        </td>
                        <td className="px-4 py-3 align-top text-stone-700">
                          {lead.email && <div className="[overflow-wrap:anywhere]">{lead.email}</div>}
                          {lead.phone && <div className="num text-[13px] text-stone-500">{lead.phone}</div>}
                          {!lead.email && !lead.phone && <span className="text-stone-600">None yet</span>}
                        </td>
                        <td className="px-4 py-3 align-top text-stone-700">
                          {lead.source || <span className="text-stone-600">Not recorded</span>}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <StatusBadge kind="lead" value={lead.status} />
                        </td>
                        <td className="py-2 pl-4 pr-5 align-top">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/quotes?lead=${lead.id}`}
                              className="btn-ghost tap whitespace-nowrap px-2 py-1.5"
                              title="New quote for this customer"
                            >
                              <FilePlus2 className="h-4 w-4" /> New quote
                            </Link>
                            <button
                              className="btn-ghost tap px-2 py-1.5"
                              title="Edit customer"
                              aria-label="Edit customer"
                              onClick={() => {
                                setFocusEmail(false);
                                setEditing(lead);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <MoreActions name={lead.customer_name} confirm={deleteOptions(lead)} onDelete={() => deleteLead(lead.id)} onError={setDeleteError} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {showNew && <LeadFormModal onClose={() => setShowNew(false)} />}
      {editing && <LeadFormModal lead={editing} focusEmail={focusEmail} onClose={() => setEditing(null)} />}
    </div>
  );
}

/**
 * The customer's less frequent actions, Delete among them: kept in a menu, away
 * from the buttons used every day, so it can't be tapped by mistake (NN/g,
 * "Proximity of consequential options"). It still asks before deleting.
 */
function MoreActions({
  name,
  confirm: options,
  onDelete,
  onError,
}: {
  name: string;
  confirm: ConfirmOptions;
  onDelete: () => Promise<ActionResult>;
  onError: (message: string | null) => void;
}) {
  const [pending, start] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  return (
    <>
      {pending ? (
        <Loader2 className="m-2.5 h-4 w-4 animate-spin text-stone-500" aria-label="Deleting" />
      ) : (
        <Menu label={`More actions for ${name}`}>
          <MenuItem
            danger
            onClick={async () => {
              if (!(await confirm(options))) return;
              onError(null);
              start(async () => {
                try {
                  const result = await onDelete();
                  if (!result.ok) onError(result.error);
                } catch (e) {
                  unstable_rethrow(e); // a redirect Next is handling itself must not be swallowed
                  onError(
                    "That didn't go through, so nothing was deleted. You may have lost your connection, or been signed out in another tab. Refresh the page and try again."
                  );
                }
              });
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete customer
          </MenuItem>
        </Menu>
      )}
      {confirmDialog}
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FilePlus2, Pencil, Plus, Search, Trash2, UserPlus, Users } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { LeadFormModal } from "./LeadFormModal";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/constants";
import type { Lead } from "@/lib/types";
import { deleteLead } from "@/app/(app)/leads/actions";

export function LeadsClient({ leads }: { leads: Lead[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [editing, setEditing] = useState<Lead | null>(null);
  const [showNew, setShowNew] = useState(false);

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

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Created automatically when you add a quote."
        actions={
          <>
            <button className="btn-secondary" onClick={() => setShowNew(true)}>
              <UserPlus className="h-4 w-4" /> Add customer
            </button>
            <Link href="/quotes?new=1" className="btn-primary">
              <Plus className="h-4 w-4" /> New quote
            </Link>
          </>
        }
      />

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
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
              <input
                className="input py-1.5 pl-8"
                placeholder="Search name, company, email or phone"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              className="input w-auto py-1.5"
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

          {filtered.length === 0 ? (
            <p className="card px-4 py-8 text-center text-sm text-stone-500">
              No customers match your search.
            </p>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50/60 text-left">
                      <th className="eyebrow px-4 py-2.5">Customer</th>
                      <th className="eyebrow px-4 py-2.5">Contact</th>
                      <th className="eyebrow px-4 py-2.5">Source</th>
                      <th className="eyebrow px-4 py-2.5">Stage</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filtered.map((lead) => (
                      <tr key={lead.id} className="hover:bg-stone-50/60">
                        <td className="px-4 py-3">
                          <div className="font-medium text-stone-900">{lead.customer_name}</div>
                          {lead.company_name && (
                            <div className="text-xs text-stone-500">{lead.company_name}</div>
                          )}
                          {lead.notes && (
                            <div className="mt-0.5 line-clamp-1 max-w-xs text-xs text-stone-400">
                              {lead.notes}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          {lead.email && <div>{lead.email}</div>}
                          {lead.phone && <div className="text-xs text-stone-500">{lead.phone}</div>}
                          {!lead.email && !lead.phone && <span className="text-stone-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          {lead.source || <span className="text-stone-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge kind="lead" value={lead.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-0.5">
                            <Link
                              href={`/quotes?lead=${lead.id}`}
                              className="btn-ghost px-2 py-1 text-xs"
                              title="New quote for this customer"
                            >
                              <FilePlus2 className="h-4 w-4" /> Quote
                            </Link>
                            <button
                              className="btn-ghost px-2 py-1"
                              title="Edit customer"
                              aria-label="Edit customer"
                              onClick={() => setEditing(lead)}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <ConfirmButton
                              className="btn-ghost px-2 py-1 text-stone-400 hover:bg-red-50 hover:text-red-700"
                              title="Delete customer"
                              confirmMessage={`Delete ${lead.customer_name}? Their quotes and follow-ups are deleted too.`}
                              action={deleteLead.bind(null, lead.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </ConfirmButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {showNew && <LeadFormModal onClose={() => setShowNew(false)} />}
      {editing && <LeadFormModal lead={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

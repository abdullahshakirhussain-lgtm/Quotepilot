"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FilePlus2, Pencil, Search, Trash2, UserPlus, Users } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { LeadFormModal } from "./LeadFormModal";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type LeadStatus,
} from "@/lib/constants";
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
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
          <p className="mt-1 text-sm text-slate-500">
            {leads.length} {leads.length === 1 ? "lead" : "leads"} total
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowNew(true)}>
          <UserPlus className="h-4 w-4" /> Add lead
        </button>
      </header>

      {leads.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search name, company, email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className="input w-auto"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as LeadStatus | "all")
            }
          >
            <option value="all">All statuses</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      )}

      {leads.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No leads yet"
          description="Add your first potential customer, then create a quote for them."
          action={
            <button className="btn-primary" onClick={() => setShowNew(true)}>
              <UserPlus className="h-4 w-4" /> Add your first lead
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-500">
          No leads match your search.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {lead.customer_name}
                      </div>
                      {lead.company_name && (
                        <div className="text-xs text-slate-500">
                          {lead.company_name}
                        </div>
                      )}
                      {lead.notes && (
                        <div className="mt-0.5 line-clamp-1 max-w-xs text-xs text-slate-400">
                          {lead.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {lead.email && <div>{lead.email}</div>}
                      {lead.phone && (
                        <div className="text-xs text-slate-500">{lead.phone}</div>
                      )}
                      {!lead.email && !lead.phone && (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {lead.source || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge kind="lead" value={lead.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/quotes?lead=${lead.id}`}
                          className="btn-ghost px-2 py-1"
                          title="New quote for this lead"
                        >
                          <FilePlus2 className="h-4 w-4" />
                        </Link>
                        <button
                          className="btn-ghost px-2 py-1"
                          title="Edit"
                          onClick={() => setEditing(lead)}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <ConfirmButton
                          className="btn-ghost px-2 py-1 text-red-500 hover:bg-red-50"
                          title="Delete lead"
                          confirmMessage={`Delete ${lead.customer_name}? This also deletes their quotes and follow-ups.`}
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

      {showNew && <LeadFormModal onClose={() => setShowNew(false)} />}
      {editing && (
        <LeadFormModal lead={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

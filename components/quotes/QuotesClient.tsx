"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CheckCircle2,
  FileText,
  Loader2,
  Pencil,
  Search,
  Send,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { QuoteFormModal } from "./QuoteFormModal";
import { AIMessageModal } from "@/components/ai/AIMessageModal";
import {
  QUOTE_STATUSES,
  QUOTE_STATUS_LABELS,
  type QuoteStatus,
} from "@/lib/constants";
import type { Lead, Quote, QuoteWithLead } from "@/lib/types";
import { formatCurrency, formatDate, relativeDay } from "@/lib/utils";
import {
  deleteQuote,
  markQuoteSent,
  setQuoteStatus,
} from "@/app/(app)/quotes/actions";

const ACTIVE: QuoteStatus[] = ["sent", "follow_up_due", "negotiating"];

export function QuotesClient({
  quotes,
  leads,
  defaultCurrency,
  initialNewLeadId,
  today,
}: {
  quotes: QuoteWithLead[];
  leads: Pick<Lead, "id" | "customer_name" | "company_name">[];
  defaultCurrency: string;
  initialNewLeadId?: string;
  /** Server-computed date so relative labels match SSR and the dashboard. */
  today: string;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | "all">("all");
  const [editing, setEditing] = useState<Quote | null>(null);
  const [showNew, setShowNew] = useState(Boolean(initialNewLeadId));
  const [aiFor, setAiFor] = useState<QuoteWithLead | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return quotes.filter((quote) => {
      if (statusFilter !== "all" && quote.status !== statusFilter) return false;
      if (!q) return true;
      return [quote.title, quote.lead?.customer_name, quote.lead?.company_name]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [quotes, query, statusFilter]);

  const canCreate = leads.length > 0;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quotes</h1>
          <p className="mt-1 text-sm text-slate-500">
            {quotes.length} {quotes.length === 1 ? "quote" : "quotes"} total
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowNew(true)}
          disabled={!canCreate}
          title={canCreate ? undefined : "Add a lead first"}
        >
          <FileText className="h-4 w-4" /> New quote
        </button>
      </header>

      {!canCreate && (
        <div className="card p-4 text-sm text-slate-600">
          You need a lead before creating a quote.{" "}
          <a href="/leads" className="font-medium text-brand-600 hover:underline">
            Add a lead →
          </a>
        </div>
      )}

      {quotes.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search quote or customer…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className="input w-auto"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as QuoteStatus | "all")
            }
          >
            <option value="all">All statuses</option>
            {QUOTE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {QUOTE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      )}

      {quotes.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No quotes yet"
          description="Create your first quote for a lead. Mark it as sent to start follow-up reminders."
          action={
            canCreate ? (
              <button className="btn-primary" onClick={() => setShowNew(true)}>
                <FileText className="h-4 w-4" /> Create a quote
              </button>
            ) : (
              <a href="/leads" className="btn-primary">
                Add a lead first
              </a>
            )
          }
        />
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-500">
          No quotes match your search.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((quote) => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              today={today}
              onEdit={() => setEditing(quote)}
              onAI={() => setAiFor(quote)}
            />
          ))}
        </div>
      )}

      {showNew && (
        <QuoteFormModal
          leads={leads}
          defaultCurrency={defaultCurrency}
          preselectLeadId={initialNewLeadId}
          onClose={() => setShowNew(false)}
        />
      )}
      {editing && (
        <QuoteFormModal
          quote={editing}
          leads={leads}
          defaultCurrency={defaultCurrency}
          onClose={() => setEditing(null)}
        />
      )}
      {aiFor && (
        <AIMessageModal
          quote={{
            id: aiFor.id,
            title: aiFor.title,
            customerName: aiFor.lead?.customer_name ?? "the customer",
          }}
          onClose={() => setAiFor(null)}
        />
      )}
    </div>
  );
}

function QuoteCard({
  quote,
  today,
  onEdit,
  onAI,
}: {
  quote: QuoteWithLead;
  today: string;
  onEdit: () => void;
  onAI: () => void;
}) {
  const [pending, start] = useTransition();
  const isActive = ACTIVE.includes(quote.status);

  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-slate-900">{quote.title}</h3>
          <p className="truncate text-sm text-slate-500">
            {quote.lead?.customer_name ?? "—"}
            {quote.lead?.company_name ? ` · ${quote.lead.company_name}` : ""}
          </p>
        </div>
        <StatusBadge kind="quote" value={quote.status} />
      </div>

      <div className="mt-3 text-2xl font-bold text-slate-900">
        {formatCurrency(Number(quote.amount), quote.currency)}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
        <div>
          <dt className="inline text-slate-400">Quoted: </dt>
          <dd className="inline text-slate-600">{formatDate(quote.quote_date)}</dd>
        </div>
        <div>
          <dt className="inline text-slate-400">Valid until: </dt>
          <dd className="inline text-slate-600">
            {quote.valid_until ? formatDate(quote.valid_until) : "—"}
          </dd>
        </div>
        <div>
          <dt className="inline text-slate-400">Follow-ups sent: </dt>
          <dd className="inline text-slate-600">{quote.follow_up_count}</dd>
        </div>
        <div>
          <dt className="inline text-slate-400">Next follow-up: </dt>
          <dd className="inline text-slate-600">
            {quote.next_follow_up_at
              ? relativeDay(quote.next_follow_up_at, today)
              : "—"}
          </dd>
        </div>
      </dl>

      {quote.notes && (
        <p className="mt-3 line-clamp-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          {quote.notes}
        </p>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <button className="btn-primary px-3 py-1.5 text-sm" onClick={onAI}>
          <Sparkles className="h-4 w-4" /> AI message
        </button>

        {quote.status === "draft" && (
          <button
            className="btn-secondary px-3 py-1.5 text-sm"
            disabled={pending}
            onClick={() => start(async () => await markQuoteSent(quote.id))}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Mark sent
          </button>
        )}

        {isActive && (
          <>
            <button
              className="btn px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50"
              disabled={pending}
              onClick={() =>
                start(async () => await setQuoteStatus(quote.id, "accepted"))
              }
            >
              <CheckCircle2 className="h-4 w-4" /> Won
            </button>
            <button
              className="btn px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              disabled={pending}
              onClick={() =>
                start(async () => await setQuoteStatus(quote.id, "rejected"))
              }
            >
              <XCircle className="h-4 w-4" /> Lost
            </button>
          </>
        )}

        <div className="ml-auto flex items-center gap-1">
          <select
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600"
            value={quote.status}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.value as QuoteStatus;
              start(async () => {
                if (next === "sent") await markQuoteSent(quote.id);
                else await setQuoteStatus(quote.id, next);
              });
            }}
            title="Change status"
          >
            {QUOTE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {QUOTE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <button className="btn-ghost px-2 py-1" title="Edit" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </button>
          <ConfirmButton
            className="btn-ghost px-2 py-1 text-red-500 hover:bg-red-50"
            title="Delete quote"
            confirmMessage={`Delete the quote "${quote.title}"? This also deletes its follow-ups and messages.`}
            action={deleteQuote.bind(null, quote.id)}
          >
            <Trash2 className="h-4 w-4" />
          </ConfirmButton>
        </div>
      </div>
    </div>
  );
}

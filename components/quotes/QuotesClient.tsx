"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  Search,
  Send,
  Sparkles,
  XCircle,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Menu, MenuDivider, MenuItem, MenuLabel } from "@/components/ui/Menu";
import { QuoteFormModal } from "./QuoteFormModal";
import { AIMessageModal } from "@/components/ai/AIMessageModal";
import type { QuoteStatus } from "@/lib/constants";
import type { Lead, Quote, QuoteWithLead } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { followUpUrgency } from "@/lib/follow-up-state";
import { deleteQuote, markQuoteSent, setQuoteStatus } from "@/app/(app)/quotes/actions";

const OPEN: QuoteStatus[] = ["sent", "follow_up_due", "negotiating"];

type Tab = "open" | "draft" | "won" | "lost" | "all";
const TABS: { key: Tab; label: string; match: (s: QuoteStatus) => boolean }[] = [
  { key: "open", label: "Open", match: (s) => OPEN.includes(s) },
  { key: "draft", label: "Drafts", match: (s) => s === "draft" },
  { key: "won", label: "Won", match: (s) => s === "accepted" },
  { key: "lost", label: "Lost", match: (s) => s === "rejected" },
  { key: "all", label: "All", match: () => true },
];

type Tone = "overdue" | "today" | "upcoming" | "muted" | "won" | "lost";

/** The one-line "what's next" for a quote, in plain language. */
function nextStep(q: QuoteWithLead, today: string): { text: string; tone: Tone } {
  if (q.status === "draft") return { text: "Not sent yet", tone: "muted" };
  if (q.status === "accepted") return { text: "Won", tone: "won" };
  if (q.status === "rejected") return { text: "Lost", tone: "lost" };
  if (q.status === "expired") return { text: "Expired", tone: "muted" };
  const u = followUpUrgency(q.next_follow_up_at, today);
  if (u.level === "overdue") {
    return { text: `Follow-up overdue by ${u.days} day${u.days === 1 ? "" : "s"}`, tone: "overdue" };
  }
  if (u.level === "today") return { text: "Follow up today", tone: "today" };
  if (u.level === "upcoming") {
    return {
      text: u.days === 1 ? "Next follow-up tomorrow" : `Next follow-up in ${u.days} days`,
      tone: "upcoming",
    };
  }
  return { text: "No reminder scheduled", tone: "muted" };
}

/** Most urgent first: overdue, today, upcoming, drafts, then closed quotes. */
function priority(q: QuoteWithLead, today: string): number {
  if (OPEN.includes(q.status)) {
    const u = followUpUrgency(q.next_follow_up_at, today);
    return u.level === "overdue" ? 0 : u.level === "today" ? 1 : u.level === "upcoming" ? 2 : 3;
  }
  return { draft: 4, expired: 5, accepted: 6, rejected: 7 }[q.status as "draft"] ?? 8;
}

const BAR: Record<Tone, string> = {
  overdue: "bg-red-500",
  today: "bg-brand-500",
  upcoming: "bg-stone-300",
  muted: "bg-stone-200",
  won: "bg-emerald-500",
  lost: "bg-red-300",
};
const TEXT: Record<Tone, string> = {
  overdue: "text-red-700 font-medium",
  today: "text-brand-700 font-medium",
  upcoming: "text-stone-600",
  muted: "text-stone-400",
  won: "text-emerald-700 font-medium",
  lost: "text-red-700",
};

export function QuotesClient({
  quotes,
  leads,
  defaultCurrency,
  initialNewLeadId,
  openNew,
  today,
}: {
  quotes: QuoteWithLead[];
  leads: Pick<Lead, "id" | "customer_name" | "company_name">[];
  defaultCurrency: string;
  initialNewLeadId?: string;
  /** Opened from "New quote" elsewhere in the app (?new=1). */
  openNew?: boolean;
  /** Viewer's local date from the server. */
  today: string;
}) {
  const hasOpen = quotes.some((q) => OPEN.includes(q.status));
  const [tab, setTab] = useState<Tab>(hasOpen ? "open" : "all");
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(Boolean(openNew || initialNewLeadId));
  const [editing, setEditing] = useState<Quote | null>(null);
  const [aiFor, setAiFor] = useState<QuoteWithLead | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.key, quotes.filter((q) => t.match(q.status)).length])),
    [quotes]
  );

  const visible = useMemo(() => {
    const match = TABS.find((t) => t.key === tab)!.match;
    const q = query.trim().toLowerCase();
    return quotes
      .filter((quote) => match(quote.status))
      .filter(
        (quote) =>
          !q ||
          [quote.title, quote.lead?.customer_name, quote.lead?.company_name]
            .filter(Boolean)
            .some((v) => (v as string).toLowerCase().includes(q))
      )
      .sort(
        (a, b) =>
          priority(a, today) - priority(b, today) ||
          (a.next_follow_up_at ?? "").localeCompare(b.next_follow_up_at ?? "") ||
          b.created_at.localeCompare(a.created_at)
      );
  }, [quotes, tab, query, today]);

  function closeNew() {
    setShowNew(false);
    // Don't reopen the form on refresh when it came from a ?new=1 link.
    if (window.location.search) window.history.replaceState(null, "", "/quotes");
  }

  const openValue = quotes
    .filter((q) => OPEN.includes(q.status))
    .reduce((s, q) => s + Number(q.amount), 0);

  return (
    <div>
      <PageHeader
        title="Quotes"
        subtitle={
          hasOpen ? (
            <>
              <span className="num font-medium text-stone-700">
                {formatCurrency(openValue, defaultCurrency)}
              </span>{" "}
              waiting on {counts.open} open {counts.open === 1 ? "quote" : "quotes"}
            </>
          ) : (
            "Every quote you send, and what happens next."
          )
        }
        actions={
          <button className="btn-primary" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4" /> New quote
          </button>
        }
      />

      {toast && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900 ring-1 ring-inset ring-emerald-200">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {toast}
          </span>
          <Link href="/follow-ups" className="font-medium underline-offset-2 hover:underline">
            View follow-ups
          </Link>
        </div>
      )}

      {quotes.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="Create your first quote"
          description="Add who it's for and what you quoted. QuotePilot reminds you when to follow up and drafts the message."
          action={
            <button className="btn-primary" onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4" /> New quote
            </button>
          }
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 overflow-x-auto" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    tab === t.key
                      ? "bg-stone-900 text-white"
                      : "text-stone-600 hover:bg-stone-900/5 hover:text-stone-900"
                  )}
                >
                  {t.label}
                  <span className={cn("num ml-1.5 text-xs", tab === t.key ? "text-stone-300" : "text-stone-400")}>
                    {counts[t.key]}
                  </span>
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
              <input
                className="input py-1.5 pl-8"
                placeholder="Search quotes or customers"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="card px-4 py-8 text-center text-sm text-stone-500">
              {query ? "No quotes match your search." : "Nothing here right now."}
            </p>
          ) : (
            <ul className="card divide-y divide-stone-100 overflow-visible">
              {visible.map((quote) => (
                <QuoteRow
                  key={quote.id}
                  quote={quote}
                  today={today}
                  onEdit={() => setEditing(quote)}
                  onWrite={() => setAiFor(quote)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {showNew && (
        <QuoteFormModal
          leads={leads}
          defaultCurrency={defaultCurrency}
          today={today}
          preselectLeadId={initialNewLeadId}
          onClose={closeNew}
          onSaved={(message) => {
            setToast(message);
            setTab("all");
          }}
        />
      )}
      {editing && (
        <QuoteFormModal
          quote={editing}
          leads={leads}
          defaultCurrency={defaultCurrency}
          today={today}
          onClose={() => setEditing(null)}
          onSaved={setToast}
        />
      )}
      {aiFor && (
        <AIMessageModal
          quote={{
            id: aiFor.id,
            title: aiFor.title,
            customerName: aiFor.lead?.customer_name ?? "the customer",
            amount: Number(aiFor.amount),
            currency: aiFor.currency,
            status: aiFor.status,
            followUpCount: aiFor.follow_up_count,
            validUntil: aiFor.valid_until,
          }}
          today={today}
          onClose={() => setAiFor(null)}
        />
      )}
    </div>
  );
}

function QuoteRow({
  quote,
  today,
  onEdit,
  onWrite,
}: {
  quote: QuoteWithLead;
  today: string;
  onEdit: () => void;
  onWrite: () => void;
}) {
  const [pending, start] = useTransition();
  const step = nextStep(quote, today);
  const isOpen = OPEN.includes(quote.status);
  const urgent = step.tone === "overdue" || step.tone === "today";
  const run = (fn: () => Promise<void>) => start(async () => await fn());

  return (
    <li className="relative flex flex-col gap-3 py-3.5 pl-5 pr-3 sm:flex-row sm:items-center">
      <span className={cn("absolute inset-y-3 left-0 w-1 rounded-r", BAR[step.tone])} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-stone-900">{quote.title}</span>
          <StatusBadge kind="quote" value={quote.status} />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-stone-500">
          <span className="truncate">
            {quote.lead?.customer_name ?? "—"}
            {quote.lead?.company_name ? ` · ${quote.lead.company_name}` : ""}
          </span>
          <span className="text-stone-300">/</span>
          <span className={TEXT[step.tone]}>{step.text}</span>
          {quote.follow_up_count > 0 && (
            <span className="text-stone-400">
              · {quote.follow_up_count} follow-up{quote.follow_up_count === 1 ? "" : "s"} sent
            </span>
          )}
        </div>
      </div>

      <div className="num text-right text-[15px] font-semibold text-stone-900 sm:w-32">
        {formatCurrency(Number(quote.amount), quote.currency)}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1 sm:flex-nowrap sm:justify-end">
        {pending && <Loader2 className="h-4 w-4 animate-spin text-stone-400" />}

        {quote.status === "draft" && (
          <button className="btn-primary" disabled={pending} onClick={() => run(() => markQuoteSent(quote.id))}>
            <Send className="h-4 w-4" /> Mark sent
          </button>
        )}
        {isOpen && (
          <>
            <button
              className="btn-ghost text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
              disabled={pending}
              onClick={() => run(() => setQuoteStatus(quote.id, "accepted"))}
            >
              <CheckCircle2 className="h-4 w-4" /> Won
            </button>
            <button
              className="btn-ghost text-red-700 hover:bg-red-50 hover:text-red-800"
              disabled={pending}
              onClick={() => run(() => setQuoteStatus(quote.id, "rejected"))}
            >
              <XCircle className="h-4 w-4" /> Lost
            </button>
            <button className={urgent ? "btn-accent" : "btn-primary"} disabled={pending} onClick={onWrite}>
              <Sparkles className="h-4 w-4" /> Write follow-up
            </button>
          </>
        )}
        {quote.status === "expired" && (
          <button className="btn-secondary" disabled={pending} onClick={onWrite}>
            <Sparkles className="h-4 w-4" /> Nudge customer
          </button>
        )}
        {quote.status === "rejected" && (
          <button className="btn-secondary" disabled={pending} onClick={onWrite}>
            <Sparkles className="h-4 w-4" /> Win back
          </button>
        )}
        {quote.status === "accepted" && (
          <button className="btn-ghost" disabled={pending} onClick={onWrite}>
            <Sparkles className="h-4 w-4" /> Say thanks
          </button>
        )}

        <Menu>
          <MenuItem onClick={onEdit}>Edit quote</MenuItem>
          <MenuDivider />
          <MenuLabel>Status</MenuLabel>
          {!isOpen && quote.status !== "draft" && (
            <MenuItem onClick={() => run(() => markQuoteSent(quote.id))}>Reopen as sent</MenuItem>
          )}
          {isOpen && quote.status !== "negotiating" && (
            <MenuItem onClick={() => run(() => setQuoteStatus(quote.id, "negotiating"))}>
              Mark negotiating
            </MenuItem>
          )}
          {!isOpen && quote.status !== "accepted" && (
            <MenuItem onClick={() => run(() => setQuoteStatus(quote.id, "accepted"))}>Mark won</MenuItem>
          )}
          {!isOpen && quote.status !== "rejected" && (
            <MenuItem onClick={() => run(() => setQuoteStatus(quote.id, "rejected"))}>Mark lost</MenuItem>
          )}
          {quote.status !== "expired" && quote.status !== "draft" && (
            <MenuItem onClick={() => run(() => setQuoteStatus(quote.id, "expired"))}>Mark expired</MenuItem>
          )}
          <MenuDivider />
          <MenuItem
            danger
            onClick={() => {
              if (window.confirm(`Delete "${quote.title}"? Its follow-ups and messages are deleted too.`)) {
                run(() => deleteQuote(quote.id));
              }
            }}
          >
            Delete quote
          </MenuItem>
        </Menu>
      </div>
    </li>
  );
}

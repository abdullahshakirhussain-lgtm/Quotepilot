"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { unstable_rethrow, useRouter, useSearchParams } from "next/navigation";
import {
  BellRing,
  CalendarCheck,
  CheckCircle2,
  FileText,
  Loader2,
  Mail,
  Plus,
  Search,
  PenLine,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { DueChip } from "@/components/ui/DueChip";
import { Menu, MenuDivider, MenuItem, MenuLabel } from "@/components/ui/Menu";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { QuoteFormModal } from "./QuoteFormModal";
import { NewQuoteModal, type QuoteCustomer } from "./NewQuoteModal";
import { SendDraftQuoteModal } from "./SendDraftQuoteModal";
import type { ResolvedTemplate } from "@/lib/templates";
import { useOpenQuote } from "./QuotePanel";
import type { QuoteBusiness } from "./NewQuoteModal";
import { AddCustomerEmailModal } from "./AddCustomerEmailModal";
import { HowItWorks } from "./HowItWorks";
import { AIMessageModal } from "@/components/ai/AIMessageModal";
import { AddBusinessEmailButton } from "@/components/ui/AddBusinessEmailButton";
import type { QuoteStatus } from "@/lib/constants";
import type { ActionResult, Quote, QuoteWithLead } from "@/lib/types";
import { cn, formatCurrency, relativeDay } from "@/lib/utils";
import { followUpUrgency } from "@/lib/follow-up-state";
import { formatMoney, sumByCurrency } from "@/lib/metrics";
import { isSampleAddress, isValidEmail } from "@/lib/email-address";
import { SampleBadge, SampleDataBanner } from "@/components/SampleData";
import {
  answerCustomerReply,
  deleteQuote,
  markQuoteSent,
  setQuoteStatus,
  undoQuoteClose,
  type QuoteCloseUndo,
  type ReplyAnswer,
} from "@/app/(app)/quotes/actions";

const OPEN: QuoteStatus[] = ["sent", "follow_up_due", "negotiating"];

/** A request that never reached the server: usually a dropped connection, or a session that ended in another tab. */
const OFFLINE_OR_SIGNED_OUT =
  "That didn't go through, so nothing changed. You may have lost your connection, or been signed out in another tab. Refresh the page and try again.";


type Tab = "open" | "draft" | "won" | "lost" | "all";
const TABS: { key: Tab; label: string; match: (s: QuoteStatus) => boolean }[] = [
  { key: "open", label: "Open", match: (s) => OPEN.includes(s) },
  { key: "draft", label: "Not sent", match: (s) => s === "draft" },
  { key: "won", label: "Won", match: (s) => s === "accepted" },
  { key: "lost", label: "Lost", match: (s) => s === "rejected" },
  { key: "all", label: "All", match: () => true },
];

type Tone = "overdue" | "today" | "upcoming" | "muted" | "won" | "lost";

/** The one-line "where this quote stands", in plain language. */
function nextStep(q: QuoteWithLead, today: string): { text: string; tone: Tone } {
  if (q.status === "draft") return { text: "Not sent yet", tone: "muted" };
  if (q.status === "accepted") return { text: "Won", tone: "won" };
  if (q.status === "rejected") return { text: "Lost", tone: "lost" };
  if (q.status === "expired") return { text: "Expired", tone: "muted" };

  const u = followUpUrgency(q.next_follow_up_at, today);
  if (u.level === "overdue") {
    return {
      text: `Waiting for customer, follow-up overdue by ${u.days} day${u.days === 1 ? "" : "s"}`,
      tone: "overdue",
    };
  }
  if (u.level === "today") return { text: "Waiting for customer, follow up today", tone: "today" };
  // Nothing is due, so the date goes in the quieter line underneath instead.
  if (u.level === "upcoming") return { text: "Waiting for customer", tone: "upcoming" };
  return { text: "Waiting for customer, no follow-up scheduled", tone: "muted" };
}

/** Most urgent first: overdue, today, upcoming, not sent, then closed quotes. */
function priority(q: QuoteWithLead, today: string): number {
  if (OPEN.includes(q.status)) {
    const u = followUpUrgency(q.next_follow_up_at, today);
    return u.level === "overdue" ? 0 : u.level === "today" ? 1 : u.level === "upcoming" ? 2 : 3;
  }
  return { draft: 4, expired: 5, accepted: 6, rejected: 7 }[q.status as "draft"] ?? 8;
}

export function QuotesClient({
  quotes,
  customers,
  defaultCurrency,
  business,
  emailEnabled,
  quoteTemplates = [],
  defaultQuoteTemplate = "quote_standard",
  replySnippets = {},
  earlierQuoteEmails = {},
  initialNewLeadId,
  openNew,
  today,
}: {
  quotes: QuoteWithLead[];
  customers: QuoteCustomer[];
  defaultCurrency: string;
  business: QuoteBusiness;
  emailEnabled: boolean;
  /** Quote email templates: ready-made (with the user's edits), then their own. */
  quoteTemplates?: ResolvedTemplate[];
  /** The one new quote emails start from. */
  defaultQuoteTemplate?: string;
  /** What each customer who replied wrote (first lines), by quote id. */
  replySnippets?: Record<string, { from: string; text: string; at: string }>;
  /** Drafts whose quote email already went out ("sent") or was never confirmed. */
  earlierQuoteEmails?: Record<string, "sent" | "pending">;
  initialNewLeadId?: string;
  /** Opened from "New quote" elsewhere in the app (?new=1). */
  openNew?: boolean;
  /** Viewer's local date from the server. */
  today: string;
}) {
  const router = useRouter();
  const openQuote = useOpenQuote();
  const hasOpen = quotes.some((q) => OPEN.includes(q.status));
  const defaultTab: Tab = hasOpen ? "open" : "all";
  // The tab lives in the address (?tab=won), so refreshing or sharing keeps it.
  const tabParam = useSearchParams().get("tab");
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : defaultTab);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (tab === defaultTab) url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    if (url.href !== window.location.href) window.history.replaceState(null, "", url.pathname + url.search);
  }, [tab, defaultTab]);
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(Boolean(openNew || initialNewLeadId));
  // "New quote" in the header or sidebar links to ?new=1. When you are already on
  // Quotes the page isn't rebuilt, so open the form whenever that link is followed.
  const newParam = useSearchParams().get("new");
  useEffect(() => {
    if (newParam === "1") setShowNew(true);
  }, [newParam]);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [aiFor, setAiFor] = useState<QuoteWithLead | null>(null);
  // A quote saved a moment ago isn't in the list until the page refreshes:
  // "Write follow-up" on it opens the writer as soon as it arrives.
  const [writeWhenListed, setWriteWhenListed] = useState<string | null>(null);
  useEffect(() => {
    if (!writeWhenListed) return;
    const quote = quotes.find((q) => q.id === writeWhenListed);
    if (!quote) return;
    setWriteWhenListed(null);
    setAiFor(quote);
  }, [quotes, writeWhenListed]);
  const [sendDraft, setSendDraft] = useState<QuoteWithLead | null>(null);
  // From the quote panel: ?edit=<id> opens the edit form, ?send=<id> the quote email.
  const editParam = useSearchParams().get("edit");
  const sendParam = useSearchParams().get("send");
  useEffect(() => {
    if (!editParam && !sendParam) return;
    const toEdit = editParam ? quotes.find((q) => q.id === editParam) : undefined;
    const toSend = sendParam ? quotes.find((q) => q.id === sendParam && q.status === "draft") : undefined;
    if (toEdit) setEditing(toEdit);
    if (toSend) setSendDraft(toSend);
    const url = new URL(window.location.href);
    url.searchParams.delete("edit");
    url.searchParams.delete("send");
    window.history.replaceState(null, "", url.pathname + url.search);
  }, [editParam, sendParam, quotes]);
  const [addEmailFor, setAddEmailFor] = useState<QuoteWithLead | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Shown after Won / Lost: where the quote went, and a way back.
  const [closed, setClosed] = useState<{ quoteId: string; title: string; kind: "won" | "lost"; undo?: QuoteCloseUndo; text?: string } | null>(null);
  const [undoing, startUndo] = useTransition();

  useEffect(() => {
    if (!closed || undoing) return;
    const t = setTimeout(() => setClosed(null), 10000);
    return () => clearTimeout(t);
  }, [closed, undoing]);

  function undoClose() {
    const notice = closed;
    if (!notice?.undo) return;
    startUndo(async () => {
      try {
        const result = await undoQuoteClose(notice.quoteId, notice.undo!);
        setClosed(
          result.ok
            ? { ...notice, undo: undefined, text: `“${notice.title}” is open again, with its reminders back.` }
            : { ...notice, undo: undefined, text: result.error }
        );
        if (result.ok) setTab("open");
      } catch (e) {
        unstable_rethrow(e); // a redirect Next is handling itself must not be swallowed
        setClosed({ ...notice, undo: undefined, text: OFFLINE_OR_SIGNED_OUT });
      }
    });
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
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
          [quote.title, quote.lead?.customer_name, quote.lead?.company_name, ...amountTexts(quote.amount)]
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
    if (window.location.search) {
      const url = new URL(window.location.href);
      url.searchParams.delete("new");
      url.searchParams.delete("lead");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }

  // Per currency: amounts in different currencies are never added together.
  const openValue = formatMoney(
    sumByCurrency(
      quotes.filter((q) => OPEN.includes(q.status)),
      defaultCurrency
    ),
    defaultCurrency
  );

  return (
    <div>
      <PageHeader
        title="Quotes"
        subtitle={
          hasOpen ? (
            <>
              <span className="num font-semibold text-stone-900">{openValue}</span>{" "}
              waiting on {counts.open} open {counts.open === 1 ? "quote" : "quotes"}
            </>
          ) : (
            "Send a quote, or track one you already sent."
          )
        }
        actions={
          // "New quote" lives in the navigation, once per screen.
          <Link
            href="/follow-ups"
            className="tap hidden items-center font-medium text-info-700 hover:underline sm:inline-flex"
          >
            View follow-ups
          </Link>
        }
      />

      {toast && (
        <div role="status" className="ql-fade mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[6px] border-2 border-emerald-600 bg-white px-4 py-2.5 text-[15px] text-stone-900">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> {toast}
          </span>
          <Link href="/follow-ups" className="shrink-0 font-medium text-info-700 hover:underline">
            View follow-ups
          </Link>
        </div>
      )}

      {quotes.some((q) => isSampleAddress(q.lead?.email)) && <SampleDataBanner />}

      {quotes.length === 0 ? (
        <div className="space-y-4">
          <HowItWorks />
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title="Add your first quote"
            description="Send it with QuoteLoop, or track one you already sent. Either way, QuoteLoop schedules the follow-ups."
            action={
              <button className="btn-primary" onClick={() => setShowNew(true)}>
                <Plus className="h-4 w-4" /> New quote
              </button>
            }
          />
        </div>
      ) : (
        <section className="card ql-in">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-[#ECEEF1] px-4 py-3 sm:px-5">
            <QuoteTabs tab={tab} counts={counts} onChange={setTab} />
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-stone-400" />
              <input
                className="input pl-9"
                placeholder="Search quotes or customers"
                aria-label="Search quotes or customers"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="px-5 py-6 text-[14px] text-stone-500">
              {query ? "No quotes match your search." : "Nothing here right now."}
            </p>
          ) : (
            <ul className="divide-y divide-[#ECEEF1]">
              {visible.map((quote, i) => (
                <QuoteRow
                  key={quote.id}
                  index={i}
                  quote={quote}
                  today={today}
                  emailEnabled={emailEnabled}
                  businessEmailOk={isValidEmail(business.email)}
                  earlierEmail={earlierQuoteEmails[quote.id] ?? null}
                  onOpen={() => openQuote(quote.id)}
                  replySnippet={replySnippets[quote.id]?.text}
                  onEdit={() => setEditing(quote)}
                  onWrite={() => setAiFor(quote)}
                  onSendQuote={() => setSendDraft(quote)}
                  onAddEmail={() => setAddEmailFor(quote)}
                  onViewFollowUps={() => router.push(`/follow-ups?quote=${quote.id}`)}
                  onTracked={() =>
                    setToast("Follow-up tracking started. Reminders are counted from today.")
                  }
                  onClosed={(kind, undo) => setClosed({ quoteId: quote.id, title: quote.title, kind, undo })}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {showNew && (
        <NewQuoteModal
          customers={customers}
          defaultCurrency={defaultCurrency}
          today={today}
          business={business}
          emailEnabled={emailEnabled}
          templates={quoteTemplates}
          defaultTemplateId={defaultQuoteTemplate}
          preselectCustomerId={initialNewLeadId}
          onClose={closeNew}
          onSaved={(message) => {
            setToast(message);
            setTab("all");
          }}
          onWriteFollowUp={(quoteId) => {
            closeNew();
            const quote = quotes.find((q) => q.id === quoteId);
            if (quote) setAiFor(quote);
            else {
              setWriteWhenListed(quoteId);
              router.refresh();
            }
          }}
        />
      )}
      {editing && (
        <QuoteFormModal
          quote={editing}
          leads={customers}
          defaultCurrency={defaultCurrency}
          today={today}
          onClose={() => setEditing(null)}
          onSaved={setToast}
        />
      )}
      {addEmailFor?.lead && (
        <AddCustomerEmailModal
          customerId={addEmailFor.lead.id}
          customerName={addEmailFor.lead.customer_name}
          onClose={() => setAddEmailFor(null)}
          onSaved={() => {
            setAddEmailFor(null);
            setToast("Email address saved. You can send this quote from QuoteLoop now.");
            // The list is server-rendered, so refresh before offering the send.
            router.refresh();
          }}
        />
      )}
      {sendDraft && (
        <SendDraftQuoteModal
          quote={sendDraft}
          business={business}
          templates={quoteTemplates}
          defaultTemplateId={defaultQuoteTemplate}
          today={today}
          onClose={() => setSendDraft(null)}
          onSent={setToast}
        />
      )}
      {closed && (
        <div
          role="status"
          className="ql-rise fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-[10px] bg-stone-900 px-4 py-3 text-[15px] text-white shadow-[0_10px_28px_rgba(21,24,28,0.3)] md:bottom-6"
        >
          <span>
            {closed.text ??
              `Marked as ${closed.kind}: “${closed.title}”. It's in the ${closed.kind === "won" ? "Won" : "Lost"} tab.`}
          </span>
          {closed.undo ? (
            <button
              type="button"
              className="tap inline-flex shrink-0 items-center font-semibold text-brand-300 underline-offset-2 hover:underline"
              onClick={undoClose}
              disabled={undoing}
            >
              {undoing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Undo"}
            </button>
          ) : (
            <button
              type="button"
              className="tap inline-flex shrink-0 items-center text-stone-400 hover:text-white"
              onClick={() => setClosed(null)}
              aria-label="Dismiss"
            >
              ×
            </button>
          )}
        </div>
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
  index,
  quote,
  today,
  emailEnabled,
  businessEmailOk,
  earlierEmail,
  onOpen,
  replySnippet,
  onEdit,
  onWrite,
  onSendQuote,
  onAddEmail,
  onViewFollowUps,
  onTracked,
  onClosed,
}: {
  /** Position in the list: rows ease in one after another. */
  index: number;
  quote: QuoteWithLead;
  today: string;
  emailEnabled: boolean;
  /** Replies need somewhere to go before QuoteLoop can send anything. */
  businessEmailOk: boolean;
  earlierEmail: "sent" | "pending" | null;
  onOpen: () => void;
  /** The first lines of the customer's reply, when they replied. */
  replySnippet?: string;
  onEdit: () => void;
  onWrite: () => void;
  onSendQuote: () => void;
  onAddEmail: () => void;
  onViewFollowUps: () => void;
  onTracked: () => void;
  /** Marked won or lost: the page says where it went and offers Undo. */
  onClosed: (kind: "won" | "lost", undo?: QuoteCloseUndo) => void;
}) {
  const [pending, start] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  // A failed Won / Lost / Delete / … stays next to the quote it was about.
  const [rowError, setRowError] = useState<string | null>(null);
  const step = nextStep(quote, today);
  const isOpen = OPEN.includes(quote.status);
  const isDraft = quote.status === "draft";
  // "Urgent" decides which action leads: chase the customer, or just look.
  const urgent = step.tone === "overdue" || step.tone === "today";
  const hasCustomerEmail = Boolean(quote.lead?.email?.trim());
  // An earlier attempt went out, or may have: sending again could duplicate it.
  const alreadyAttempted = earlierEmail !== null;
  const sendingReady = emailEnabled && businessEmailOk;
  // Demo customers' addresses can't receive mail, so their quotes are never emailed.
  const sample = isSampleAddress(quote.lead?.email);
  const canEmailQuote = sendingReady && hasCustomerEmail && !alreadyAttempted && !sample;
  const offerAddEmail = sendingReady && !hasCustomerEmail && !alreadyAttempted;
  // Sending is only blocked on the business email: a direct way to add it.
  const offerBusinessEmail = emailEnabled && !businessEmailOk && !alreadyAttempted;
  const run = (fn: () => Promise<ActionResult>, onDone?: () => void) =>
    start(async () => {
      setRowError(null);
      try {
        const result = await fn();
        if (!result.ok) return setRowError(result.error);
        onDone?.();
      } catch (e) {
        unstable_rethrow(e); // a redirect Next is handling itself must not be swallowed
        setRowError(OFFLINE_OR_SIGNED_OUT);
      }
    });

  const close = (status: "accepted" | "rejected") =>
    start(async () => {
      setRowError(null);
      try {
        const result = await setQuoteStatus(quote.id, status);
        if (!result.ok) return setRowError(result.error);
        onClosed(status === "accepted" ? "won" : "lost", result.undo);
      } catch (e) {
        unstable_rethrow(e); // a redirect Next is handling itself must not be swallowed
        setRowError(OFFLINE_OR_SIGNED_OUT);
      }
    });

  // The customer replied: reminders are paused until the owner says what's next.
  const replied = isOpen && Boolean(quote.customer_replied_at);
  const answer = (choice: ReplyAnswer) =>
    start(async () => {
      setRowError(null);
      try {
        const result = await answerCustomerReply(quote.id, choice);
        if (!result.ok) return setRowError(result.error);
        if (choice === "accepted" || choice === "rejected") onClosed(choice === "accepted" ? "won" : "lost", result.undo);
      } catch (e) {
        unstable_rethrow(e); // a redirect Next is handling itself must not be swallowed
        setRowError(OFFLINE_OR_SIGNED_OUT);
      }
    });

  // Why a draft can't be emailed, in the user's terms.
  const draftHint = !isDraft
    ? null
    : sample
      ? "This is a sample quote, so it can't be emailed. Use “I already sent this” to try the follow-up reminders."
      : earlierEmail === "sent"
      ? "The quote email was already sent from QuoteLoop, so it won't be sent again. Use “I already sent this” to start its follow-ups."
      : earlierEmail === "pending"
        ? "QuoteLoop couldn't confirm an earlier quote email was delivered, so it won't send it again. If the customer has it, use “I already sent this”."
        : !emailEnabled
          ? "Email sending is not configured. You can still track a quote you sent elsewhere."
          : !businessEmailOk
            ? "Add your business email in Settings before sending from QuoteLoop, or use “I already sent this” if you sent it another way."
            : !hasCustomerEmail
            ? "Add an email address to send this quote from QuoteLoop, or mark it as already sent if you sent it elsewhere."
            : null;

  // At most one main and one second action in view; everything else is in ⋯.
  const urgentOpen = isOpen && urgent;
  return (
    <li
      className="ql-in grid grid-cols-1 gap-x-6 gap-y-3 px-4 py-4 transition-colors hover:bg-stone-50/60 sm:px-5 md:grid-cols-[minmax(0,1fr)_auto]"
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h3 className="text-[16px] font-medium leading-snug text-stone-900 [overflow-wrap:anywhere]">
            {/* Opens the quote's own page as a panel over the list. */}
            <button type="button" className="tap inline-flex items-center text-left hover:underline" onClick={onOpen}>
              {quote.title}
            </button>
          </h3>
          <StatusBadge kind="quote" value={quote.status} />
          {sample && <SampleBadge />}
        </div>
        <p className="mt-0.5 text-[14px] text-stone-600 [overflow-wrap:anywhere]">
          {quote.lead?.customer_name ?? "Customer"}
          {quote.lead?.company_name ? `, ${quote.lead.company_name}` : ""}
        </p>
        {/* When the next follow-up is due, as a chip; the status badge says the rest. */}
        {(isOpen || quote.follow_up_count > 0 || quote.sent_method) && (
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-stone-500">
            {/* A reply says so in its own prompt below. */}
            {isOpen &&
              !replied &&
              (quote.next_follow_up_at ? (
                <DueChip dueDate={quote.next_follow_up_at} today={today} />
              ) : (
                <span>{step.text}</span>
              ))}
            {quote.follow_up_count > 0 && (
              <span>
                {quote.follow_up_count} follow-up{quote.follow_up_count === 1 ? "" : "s"} sent
              </span>
            )}
            {quote.sent_method && <span>Sent by {quote.sent_method}</span>}
          </p>
        )}
        {replied && (
          <div className="mt-3 max-w-2xl rounded-[10px] bg-info-50 px-3 py-2.5" data-reply-prompt>
            <p className="text-[14px] text-info-700">
              <span className="font-medium">
                {(quote.lead?.customer_name ?? "The customer").split(" ")[0]} replied {relativeDay(quote.customer_replied_at!, today)}.
              </span>{" "}
              Reminders are paused. What&apos;s next?
            </p>
            {replySnippet && (
              <p className="mt-1 line-clamp-2 text-[14px] text-stone-800 [overflow-wrap:anywhere]">&ldquo;{replySnippet}&rdquo;</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn-secondary bg-white px-3 py-1.5" disabled={pending} onClick={() => answer("negotiating")}>
                Negotiating
              </button>
              <button className="btn-secondary bg-white px-3 py-1.5" disabled={pending} onClick={() => answer("accepted")}>
                Won
              </button>
              <button className="btn-secondary bg-white px-3 py-1.5" disabled={pending} onClick={() => answer("rejected")}>
                Lost
              </button>
              <button className="btn-ghost px-3 py-1.5" disabled={pending} onClick={() => answer("resume")}>
                Resume reminders
              </button>
              <button className="btn-ghost px-3 py-1.5 text-info-700" onClick={onOpen}>
                Read and reply
              </button>
            </div>
          </div>
        )}
        {draftHint && <p className="mt-1 max-w-2xl text-[15px] text-stone-600">{draftHint}</p>}
        {rowError && (
          <p role="alert" className="mt-1 text-[15px] font-medium text-red-700">
            {rowError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 md:items-end">
        <span className="num text-[20px] font-semibold leading-none text-stone-900 [overflow-wrap:anywhere]">
          {formatCurrency(Number(quote.amount), quote.currency)}
        </span>
        <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:justify-end">
          {pending && <Loader2 className="h-4 w-4 animate-spin text-stone-500" />}

          {/* Drafts: one obvious way forward, whether or not we can email it.
              Row actions are outlined: the one dark button is "New quote". */}
          {isDraft && (
            <>
              {canEmailQuote && (
                <button className="btn-secondary" disabled={pending} onClick={onSendQuote}>
                  <Mail className="h-4 w-4" /> Send quote email
                </button>
              )}
              {offerAddEmail && (
                <button className="btn-secondary" disabled={pending} onClick={onAddEmail}>
                  <Mail className="h-4 w-4" /> Add customer email
                </button>
              )}
              {offerBusinessEmail && <AddBusinessEmailButton />}
              <button
                className="btn-secondary"
                disabled={pending}
                title="Record that you sent this quote yourself"
                onClick={() => run(() => markQuoteSent(quote.id), onTracked)}
              >
                <CalendarCheck className="h-4 w-4" /> I already sent this
              </button>
            </>
          )}
          {/* Sent: chase when a follow-up is due, otherwise look; Won is one tap. */}
          {urgentOpen && (
            <button className="btn-secondary" disabled={pending} onClick={onWrite}>
              <PenLine className="h-4 w-4" /> Write follow-up
            </button>
          )}
          {isOpen && !urgent && (
            <button className="btn-secondary" disabled={pending} onClick={onViewFollowUps}>
              <BellRing className="h-4 w-4" /> View follow-ups
            </button>
          )}
          {isOpen && (
            <button className="btn-secondary" disabled={pending} onClick={() => close("accepted")}>
              <CheckCircle2 className="h-4 w-4" /> Won
            </button>
          )}
          {quote.status === "expired" && (
            <button className="btn-secondary" disabled={pending} onClick={onWrite}>
              <PenLine className="h-4 w-4" /> Nudge customer
            </button>
          )}
          {quote.status === "rejected" && (
            <button className="btn-secondary" disabled={pending} onClick={onWrite}>
              <PenLine className="h-4 w-4" /> Win back
            </button>
          )}
          {quote.status === "accepted" && (
            <button className="btn-secondary" disabled={pending} onClick={onWrite}>
              <PenLine className="h-4 w-4" /> Say thanks
            </button>
          )}

          <Menu label={`More actions for ${quote.title}`}>
            {urgentOpen && <MenuItem onClick={onViewFollowUps}>View follow-ups</MenuItem>}
            <MenuItem onClick={onEdit}>Edit quote</MenuItem>
            {isOpen && !urgent && <MenuItem onClick={onWrite}>Write early follow-up</MenuItem>}
            <MenuDivider />
            <MenuLabel>Status</MenuLabel>
            {!isOpen && quote.status !== "draft" && (
              <MenuItem onClick={() => run(() => markQuoteSent(quote.id))}>Reopen as sent</MenuItem>
            )}
            {isOpen && quote.status !== "negotiating" && (
              <MenuItem onClick={() => run(() => setQuoteStatus(quote.id, "negotiating"))}>Mark negotiating</MenuItem>
            )}
            {quote.status !== "accepted" && quote.status !== "draft" && !isOpen && (
              <MenuItem onClick={() => close("accepted")}>Mark won</MenuItem>
            )}
            {quote.status !== "rejected" && quote.status !== "draft" && (
              <MenuItem onClick={() => close("rejected")}>Mark lost</MenuItem>
            )}
            {quote.status !== "expired" && quote.status !== "draft" && (
              <MenuItem onClick={() => run(() => setQuoteStatus(quote.id, "expired"))}>Mark expired</MenuItem>
            )}
            <MenuDivider />
            <MenuItem
              danger
              onClick={async () => {
                const ok = await confirm({
                  title: "Delete this quote?",
                  message: (
                    <>
                      Delete “{quote.title}”? Its follow-ups and messages are deleted too. Records of emails QuoteLoop
                      already sent are kept.
                    </>
                  ),
                  confirmLabel: "Delete quote",
                  cancelLabel: "Keep quote",
                  danger: true,
                });
                if (ok) run(() => deleteQuote(quote.id));
              }}
            >
              Delete quote
            </MenuItem>
          </Menu>
        </div>
      </div>
      {confirmDialog}
    </li>
  );
}

/** An amount as people might search for it: 1500, 1500.50, 1,500.50. */
function amountTexts(amount: number | string): string[] {
  const n = Number(amount);
  if (!Number.isFinite(n)) return [];
  return [String(n), n.toFixed(2), n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })];
}

/** Open / Not sent / Won / Lost / All, as pill buttons; the chosen one is filled. */
function QuoteTabs({ tab, counts, onChange }: { tab: Tab; counts: Record<string, number>; onChange: (t: Tab) => void }) {
  return (
    <div role="tablist" aria-label="Quote status" className="flex max-w-full gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TABS.map((t) => {
        const on = tab === t.key;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.key)}
            className={cn(
              "tap inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-[14px] font-medium transition-colors duration-150",
              on ? "border-stone-300 bg-stone-200/80 text-stone-900" : "border-line bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900"
            )}
          >
            {t.label}
            <span className={cn("num rounded-full px-1.5 text-[12px] leading-5", on ? "bg-white text-stone-900" : "bg-stone-100 text-stone-700")}>
              {counts[t.key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

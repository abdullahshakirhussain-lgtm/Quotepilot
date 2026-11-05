"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, Paperclip, Phone, PenLine, Reply, Send } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Menu, MenuDivider, MenuItem } from "@/components/ui/Menu";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DueChip } from "@/components/ui/DueChip";
import { AIMessageModal, type ReplyContext } from "@/components/ai/AIMessageModal";
import { newPartOfReply } from "@/lib/reply-text";
import { useCanWrite } from "@/components/billing/AccessContext";
import type { QuoteCloseUndo, ReplyAnswer } from "@/app/(app)/quotes/actions";
import type { QuoteStatus } from "@/lib/constants";
import { formatCurrency, formatDate, relativeDay } from "@/lib/utils";

/** The address of the page you're on with the quote panel open (or closed). */
export function quotePanelHref(pathname: string, search: URLSearchParams | string, quoteId: string | null): string {
  const params = new URLSearchParams(search);
  if (quoteId) params.set("view", quoteId);
  else params.delete("view");
  const q = params.toString();
  return q ? `${pathname}?${q}` : pathname;
}

/**
 * Opens the quote panel over the page you're on (Back closes it). Only the
 * address changes, with no trip to the server: on the dashboard and settings
 * pages a same-page navigation can stall (Next 15.5).
 */
export function openQuote(quoteId: string) {
  window.history.pushState(null, "", quotePanelHref(window.location.pathname, window.location.search, quoteId));
}

export function useOpenQuote() {
  return openQuote;
}

/** A link to a quote: opens its panel, or a new tab with the usual keys. */
export function QuoteLink({
  quoteId,
  className,
  children,
  ...rest
}: { quoteId: string; className?: string; children: React.ReactNode } & React.AriaAttributes) {
  const search = useSearchParams();
  return (
    <a
      {...rest}
      // Relative ("?view=…"), so the server and the browser render the same link.
      href={quotePanelHref("", search.toString(), quoteId)}
      className={className}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        openQuote(quoteId);
      }}
    >
      {children}
    </a>
  );
}

interface PanelQuote {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  amount: number | string;
  currency: string;
  status: QuoteStatus;
  quote_date: string;
  valid_until: string | null;
  sent_method: string | null;
  follow_up_count: number;
  next_follow_up_at: string | null;
  customer_replied_at?: string | null;
  created_at: string;
  lead: { id: string; customer_name: string; company_name: string | null; email: string | null; phone: string | null } | null;
}
interface PanelData {
  quote: PanelQuote;
  followUps: {
    id: string;
    due_date: string;
    status: "pending" | "completed" | "skipped";
    follow_up_number: number;
    completed_at: string | null;
    paused_by_reply?: boolean;
    message_snapshot?: string | null;
  }[];
  emails: {
    id: string;
    follow_up_id: string | null;
    recipient_email: string;
    subject: string | null;
    body: string | null;
    status: string;
    created_at: string;
    sent_at: string | null;
  }[];
  replies: {
    id: string;
    from_name: string | null;
    from_email: string;
    subject: string | null;
    body: string | null;
    attachment_names: string[] | null;
    received_at: string;
    auto_reply: boolean;
  }[];
}

type Event = {
  key: string;
  at: string;
  title: string;
  detail?: string;
  tone?: "good" | "bad" | "reply";
  /** The message itself, when there is one. */
  text?: string;
  /** Said instead, when a reply's text wasn't kept. */
  note?: string;
  attachments?: string[];
  /** The reply the files came with: each opens from QuoteLoop. */
  filesOf?: string;
  /** A customer's reply that can be answered. */
  reply?: ReplyContext;
};

/** The short "why you got this" footer is added when sending: show the message itself. */
function withoutFooter(body: string | null | undefined): string {
  const b = body ?? "";
  const i = Math.max(b.lastIndexOf("\n\n--\n"), b.lastIndexOf("\n\n\u2014\n"));
  return (i === -1 ? b : b.slice(0, i)).trim();
}

const OPEN: QuoteStatus[] = ["sent", "follow_up_due", "negotiating"];
const OFFLINE =
  "That didn't go through, so nothing changed. You may have lost your connection, or been signed out in another tab. Refresh the page and try again.";

/** Everything that happened to the quote, newest first. */
function history(d: PanelData): Event[] {
  const q = d.quote;
  const events: Event[] = [];
  // Emails not tied to a reminder. A customer can only reply once QuoteLoop
  // has emailed them about this quote, so any sent after their first reply is
  // an answer; before that, the one sent within a day of the quote is the
  // quote email itself.
  const loose = d.emails
    .filter((e) => !e.follow_up_id && e.status === "sent")
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const firstReply = Math.min(...d.replies.map((r) => Date.parse(r.received_at)), Infinity);
  const quoteEmail = loose.find(
    (e) => Date.parse(e.created_at) < firstReply && Date.parse(e.created_at) - Date.parse(q.created_at) < 24 * 3600 * 1000
  );
  if (q.status === "draft") {
    events.push({ key: "draft", at: q.created_at, title: "Saved as a draft", detail: "Not sent to the customer yet" });
  } else if (quoteEmail) {
    events.push({
      key: `e-${quoteEmail.id}`,
      at: quoteEmail.sent_at ?? quoteEmail.created_at,
      title: "You emailed the quote",
      detail: `To ${quoteEmail.recipient_email}`,
      text: withoutFooter(quoteEmail.body),
    });
  } else {
    events.push({ key: "sent", at: q.quote_date, title: "Quote sent", detail: q.sent_method ? `By ${q.sent_method}` : undefined });
  }
  for (const e of loose) {
    if (e === quoteEmail) continue;
    const answer = Date.parse(e.created_at) > firstReply;
    events.push({
      key: `e-${e.id}`,
      at: e.sent_at ?? e.created_at,
      title: answer ? "You replied" : "You emailed them",
      detail: e.subject ?? undefined,
      text: withoutFooter(e.body),
      tone: "good",
    });
  }
  for (const f of d.followUps) {
    if (f.status === "completed") {
      const email = d.emails.find((e) => e.follow_up_id === f.id && e.status === "sent");
      events.push({
        key: `f-${f.id}`,
        at: f.completed_at ?? f.due_date,
        title: `Follow-up ${f.follow_up_number} ${email ? "emailed" : "done"}`,
        detail: email ? `To ${email.recipient_email}` : "Recorded as sent another way",
        text: f.message_snapshot ?? undefined,
        tone: "good",
      });
    } else if (f.status === "skipped" && !f.paused_by_reply) {
      events.push({ key: `f-${f.id}`, at: f.due_date, title: `Follow-up ${f.follow_up_number} skipped` });
    }
  }
  for (const e of d.emails) {
    if (e.status === "failed") events.push({ key: `e-${e.id}`, at: e.created_at, title: "An email failed", detail: `To ${e.recipient_email}, nothing was recorded`, tone: "bad" });
    if (e.status === "pending") events.push({ key: `e-${e.id}`, at: e.created_at, title: "Email not confirmed", detail: `To ${e.recipient_email}: it may or may not have arrived`, tone: "bad" });
  }
  for (const r of d.replies) {
    const from = r.from_name ?? r.from_email;
    const text = newPartOfReply(r.body ?? "");
    events.push({
      key: `r-${r.id}`,
      at: r.received_at,
      title: `${from} ${r.auto_reply ? "sent an automatic reply" : "replied"}`,
      detail: r.subject ?? undefined,
      text: text || undefined,
      note: text ? undefined : "The text of this reply wasn't saved in QuoteLoop. It's in your email inbox.",
      attachments: r.attachment_names ?? undefined,
      filesOf: r.id,
      tone: "reply",
      reply: r.auto_reply ? undefined : { id: r.id, subject: r.subject, from, text },
    });
  }
  return events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** A message in the history: a few lines, with the rest one tap away. */
function MessageText({ text }: { text: string }) {
  const [all, setAll] = useState(false);
  const long = text.split("\n").length > 5 || text.length > 360;
  return (
    <div className="mt-1.5">
      {/* The padding is on the box, the cut on the text: no half line shows below. */}
      <div className="rounded-[8px] bg-canvas px-3 py-2">
        <p
          className={`whitespace-pre-wrap text-[14px] leading-relaxed text-stone-800 [overflow-wrap:anywhere] ${
            all || !long ? "" : "line-clamp-5"
          }`}
        >
          {text}
        </p>
      </div>
      {long && (
        <button type="button" className="tap inline-flex items-center text-[13px] font-medium text-info-700 hover:underline" onClick={() => setAll((a) => !a)}>
          {all ? "Show less" : "Show all"}
        </button>
      )}
    </div>
  );
}

/**
 * The quote page, as a panel over whatever page you're on: open from any
 * quote (?view=<id>). Mounted once in the app layout.
 */
export function QuotePanelHost({ today }: { today: string }) {
  const search = useSearchParams();
  const quoteId = search.get("view");

  // Closing only changes the address; after a change it reloads the page
  // underneath so its lists and totals are current.
  const close = useCallback((changed: boolean) => {
    const href = quotePanelHref(window.location.pathname, window.location.search, null);
    if (changed) window.location.replace(href);
    else window.history.replaceState(null, "", href);
  }, []);

  if (!quoteId) return null;
  return <QuotePanel key={quoteId} quoteId={quoteId} today={today} onClose={close} />;
}

async function act(quoteId: string, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; undo?: QuoteCloseUndo }> {
  const res = await fetch(`/api/quotes/${encodeURIComponent(quoteId)}/actions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!data || typeof data.ok !== "boolean") return { ok: false, error: OFFLINE };
  return data;
}

function QuotePanel({ quoteId, today, onClose }: { quoteId: string; today: string; onClose: (changed: boolean) => void }) {
  const router = useRouter();
  // Something here changed the quote: the page underneath reloads on close.
  const changed = useRef(false);
  const canWrite = useCanWrite();
  const [data, setData] = useState<PanelData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; undo?: QuoteCloseUndo } | null>(null);
  // Writing a follow-up (true) or answering a reply.
  const [writing, setWriting] = useState<false | true | ReplyContext>(false);
  const [busy, start] = useTransition();
  const [confirm, confirmDialog] = useConfirm();

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/quotes/${encodeURIComponent(quoteId)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setLoadError(body.error ?? "This quote couldn't be loaded just now. Try again.");
      setLoadError(null);
      setData(body as PanelData);
    } catch {
      setLoadError("QuoteLoop couldn't be reached. Check your connection and try again.");
    }
  }, [quoteId]);

  useEffect(() => {
    load();
  }, [load]);

  const run = (body: Record<string, unknown>, done?: (r: { undo?: QuoteCloseUndo }) => void) =>
    start(async () => {
      setError(null);
      setNotice(null);
      try {
        const result = await act(quoteId, body);
        if (!result.ok) return setError(result.error ?? OFFLINE);
        changed.current = true;
        done?.(result);
        await load();
      } catch {
        setError(OFFLINE);
      }
    });

  const close = (status: "accepted" | "rejected") =>
    run({ op: "status", status }, (r) =>
      setNotice({ text: status === "accepted" ? "Marked won. Reminders stopped." : "Marked lost. Reminders stopped.", undo: r.undo })
    );
  const answer = (choice: ReplyAnswer) =>
    run({ op: "answer", answer: choice }, (r) => {
      if (choice === "accepted" || choice === "rejected") setNotice({ text: choice === "accepted" ? "Marked won." : "Marked lost.", undo: r.undo });
      if (choice === "resume") setNotice({ text: "Reminders are back on." });
    });

  async function remove() {
    const q = data?.quote;
    if (!q) return;
    const ok = await confirm({
      title: `Delete "${q.title}"?`,
      message: "Its reminders and drafted messages go too. Records of emails already sent are kept.",
      confirmLabel: "Delete quote",
      cancelLabel: "Keep quote",
      danger: true,
    });
    if (!ok) return;
    start(async () => {
      try {
        const result = await act(quoteId, { op: "delete" });
        if (!result.ok) return setError(result.error ?? OFFLINE);
        onClose(true);
      } catch {
        setError(OFFLINE);
      }
    });
  }

  const q = data?.quote;
  const isOpen = q ? OPEN.includes(q.status) : false;
  const replied = isOpen && Boolean(q?.customer_replied_at);
  const pending = data?.followUps.filter((f) => f.status === "pending") ?? [];
  // Reminders paused by a reply, shown as such while the reply waits for an answer.
  const paused = q?.customer_replied_at ? (data?.followUps.filter((f) => f.status === "skipped" && f.paused_by_reply) ?? []) : [];
  const latestReply = data?.replies.find((r) => !r.auto_reply);
  const latestReplyContext: ReplyContext | null = latestReply
    ? { id: latestReply.id, subject: latestReply.subject, from: latestReply.from_name ?? latestReply.from_email, text: newPartOfReply(latestReply.body ?? "") }
    : null;
  const firstName = (q?.lead?.customer_name ?? "The customer").split(" ")[0];
  const validPast = q?.valid_until ? q.valid_until < today : false;

  return (
    <Modal
      open
      onClose={() => {
        if (!busy) onClose(changed.current);
      }}
      size="panel"
      title={q ? q.title : loadError ? "Quote" : "Loading quote…"}
      description={
        q ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className="[overflow-wrap:anywhere]">{q.lead?.customer_name ?? "Customer"}</span>
            <StatusBadge kind="quote" value={q.status} />
          </span>
        ) : undefined
      }
    >
      {loadError && (
        <div className="msg-error">
          {loadError}{" "}
          <button className="font-medium underline" onClick={() => load()}>
            Try again
          </button>
        </div>
      )}

      {!data && !loadError && (
        <div className="card space-y-3 p-5" aria-live="polite">
          <div className="h-6 w-1/3 rounded bg-stone-100" />
          <div className="h-4 w-2/3 rounded bg-stone-100" />
          <div className="h-4 w-1/2 rounded bg-stone-100" />
        </div>
      )}

      {q && data && (
        <>
          {/* Amount and the one thing to do next */}
          <section className="card p-5" aria-label="Quote">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="num text-[28px] font-semibold leading-none text-stone-900 [overflow-wrap:anywhere]">
                {formatCurrency(Number(q.amount), q.currency)}
              </span>
              {isOpen && !replied && q.next_follow_up_at && <DueChip dueDate={q.next_follow_up_at} today={today} />}
            </div>
            {canWrite && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {q.status === "draft" ? (
                  <Link href={`/quotes?tab=all&send=${q.id}`} className="btn-primary">
                    <Send className="h-4 w-4" /> Send quote email
                  </Link>
                ) : isOpen ? (
                  <button className="btn-primary" onClick={() => setWriting(true)} disabled={busy}>
                    <PenLine className="h-4 w-4" /> Write follow-up
                  </button>
                ) : null}
                {isOpen && !replied && (
                  <>
                    <button className="btn-secondary" onClick={() => close("accepted")} disabled={busy}>
                      Won
                    </button>
                    <button className="btn-secondary" onClick={() => close("rejected")} disabled={busy}>
                      Lost
                    </button>
                  </>
                )}
                {busy && <Loader2 className="h-4 w-4 animate-spin text-stone-500" />}
                <div className="ml-auto">
                  <Menu label={`More actions for ${q.title}`}>
                    <MenuItem onClick={() => router.push(`/quotes?tab=all&edit=${q.id}`)}>Edit details</MenuItem>
                    {isOpen && q.status !== "negotiating" && (
                      <MenuItem onClick={() => run({ op: "status", status: "negotiating" })}>Mark negotiating</MenuItem>
                    )}
                    {isOpen && <MenuItem onClick={() => run({ op: "status", status: "expired" })}>Mark expired</MenuItem>}
                    <MenuDivider />
                    <MenuItem danger onClick={remove}>
                      Delete quote
                    </MenuItem>
                  </Menu>
                </div>
              </div>
            )}
            {notice && (
              <div role="status" className="msg-success mt-4 flex flex-wrap items-center justify-between gap-2">
                <span>{notice.text}</span>
                {notice.undo && (
                  <button
                    className="font-medium underline"
                    disabled={busy}
                    onClick={() => run({ op: "undo", undo: notice.undo }, () => setNotice({ text: "Undone." }))}
                  >
                    Undo
                  </button>
                )}
              </div>
            )}
            {error && (
              <p role="alert" className="mt-3 text-[14px] font-medium text-red-700">
                {error}
              </p>
            )}
          </section>

          {replied && (
            <section className="rounded-[12px] bg-info-50 p-4" data-reply-prompt aria-label="Customer replied">
              <p className="text-[15px] text-info-700">
                <span className="font-medium">
                  {firstName} replied {relativeDay(q.customer_replied_at!, today)}.
                </span>{" "}
                Reminders are paused. What&apos;s next?
              </p>
              {latestReplyContext?.text && (
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-[14px] text-stone-800 [overflow-wrap:anywhere]">
                  &ldquo;{latestReplyContext.text}&rdquo;
                </p>
              )}
              {canWrite && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {latestReplyContext && (
                    <button className="btn-primary" disabled={busy} onClick={() => setWriting(latestReplyContext)}>
                      <Reply className="h-4 w-4" /> Reply
                    </button>
                  )}
                  <button className="btn-secondary bg-white" disabled={busy} onClick={() => answer("negotiating")}>
                    Negotiating
                  </button>
                  <button className="btn-secondary bg-white" disabled={busy} onClick={() => answer("accepted")}>
                    Won
                  </button>
                  <button className="btn-secondary bg-white" disabled={busy} onClick={() => answer("rejected")}>
                    Lost
                  </button>
                  <button className="btn-ghost" disabled={busy} onClick={() => answer("resume")}>
                    Resume reminders
                  </button>
                </div>
              )}
            </section>
          )}

          {pending.length + paused.length > 0 && (
            <section className="card p-5" aria-labelledby="panel-next">
              <h3 id="panel-next" className="text-[16px] font-medium text-stone-900">
                Coming up
              </h3>
              <ul className="mt-3 flex flex-col gap-2.5">
                {pending.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 text-[14px]">
                    <span className="text-stone-700">Follow-up {f.follow_up_number}</span>
                    <DueChip dueDate={f.due_date} today={today} />
                  </li>
                ))}
                {paused.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 text-[14px]">
                    <span className="text-stone-500">Follow-up {f.follow_up_number}</span>
                    <span className="chip-muted" title="The customer replied. Resume reminders brings it back.">
                      Paused
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card p-5" aria-labelledby="panel-history">
            <h3 id="panel-history" className="text-[16px] font-medium text-stone-900">
              What happened
            </h3>
            <ol className="mt-3 flex flex-col gap-3 border-l-2 border-line pl-4">
              {history(data).map((e) => (
                <li key={e.key} className="relative">
                  <span
                    aria-hidden
                    className={`absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ${
                      e.tone === "good" ? "bg-emerald-600" : e.tone === "bad" ? "bg-red-600" : e.tone === "reply" ? "bg-info-500" : "bg-stone-400"
                    }`}
                  />
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-[14px] font-medium text-stone-900 [overflow-wrap:anywhere]">{e.title}</span>
                    <span className="num text-[13px] text-stone-500">{formatDate(e.at)}</span>
                  </div>
                  {e.detail && <p className="text-[13px] text-stone-500 [overflow-wrap:anywhere]">{e.detail}</p>}
                  {e.text && <MessageText text={e.text} />}
                  {e.note && <p className="mt-1 text-[13px] italic text-stone-500">{e.note}</p>}
                  {e.attachments && e.attachments.length > 0 && (
                    <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Files they sent">
                      {e.attachments.map((name, n) => (
                        <li key={`${n}-${name}`} className="min-w-0">
                          {e.filesOf ? (
                            // A fresh page: the file opens from Resend's link (it works for an hour).
                            <a
                              href={`/api/replies/${e.filesOf}/files/${n}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="tap inline-flex max-w-full items-center gap-1.5 rounded-md border border-line bg-white px-2.5 text-[13px] text-stone-800 hover:border-stone-400"
                              aria-label={`Open ${name} (opens in a new tab)`}
                            >
                              <Paperclip className="h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden />
                              <span className="truncate">{name}</span>
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[13px] text-stone-500">
                              <Paperclip className="h-3.5 w-3.5" aria-hidden />
                              {name}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {e.reply && canWrite && q.status !== "draft" && (
                    <button type="button" className="btn-secondary mt-2 px-3 py-1.5" onClick={() => setWriting(e.reply!)}>
                      <Reply className="h-4 w-4" /> Reply
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </section>

          <section className="card p-5" aria-labelledby="panel-customer">
            <h3 id="panel-customer" className="text-[16px] font-medium text-stone-900">
              Customer
            </h3>
            <p className="mt-2 text-[15px] text-stone-900 [overflow-wrap:anywhere]">
              {q.lead?.customer_name ?? "Customer"}
              {q.lead?.company_name ? <span className="text-stone-500">, {q.lead.company_name}</span> : null}
            </p>
            <div className="mt-2 flex flex-col gap-1.5 text-[14px]">
              {q.lead?.email ? (
                <a href={`mailto:${q.lead.email}`} className="tap inline-flex items-center gap-2 text-info-700 hover:underline [overflow-wrap:anywhere]">
                  <Mail className="h-4 w-4 shrink-0" /> {q.lead.email}
                </a>
              ) : (
                <span className="text-stone-500">No email address</span>
              )}
              {q.lead?.phone && (
                <a href={`tel:${q.lead.phone.replace(/[^\d+]/g, "")}`} className="tap inline-flex items-center gap-2 text-info-700 hover:underline">
                  <Phone className="h-4 w-4 shrink-0" /> {q.lead.phone}
                </a>
              )}
            </div>
          </section>

          <section className="card p-5" aria-labelledby="panel-details">
            <h3 id="panel-details" className="text-[16px] font-medium text-stone-900">
              Details
            </h3>
            <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-[14px]">
              <dt className="text-stone-500">{q.status === "draft" ? "Created" : "Sent"}</dt>
              <dd className="num text-right text-stone-900">{formatDate(q.status === "draft" ? q.created_at : q.quote_date)}</dd>
              {q.sent_method && (
                <>
                  <dt className="text-stone-500">Sent by</dt>
                  <dd className="text-right text-stone-900">{q.sent_method}</dd>
                </>
              )}
              <dt className="text-stone-500">Valid until</dt>
              <dd className="num text-right text-stone-900">
                {formatDate(q.valid_until)}
                {validPast && isOpen && <span className="chip-late ml-2">Past</span>}
              </dd>
              <dt className="text-stone-500">Follow-ups sent</dt>
              <dd className="num text-right text-stone-900">{q.follow_up_count}</dd>
            </dl>
            {q.description && (
              <p className="mt-4 whitespace-pre-wrap border-t border-line pt-3 text-[14px] text-stone-700 [overflow-wrap:anywhere]">{q.description}</p>
            )}
            {q.notes && (
              <div className="mt-3 rounded-[8px] bg-canvas p-3">
                <div className="text-[12px] font-medium text-stone-500">Your notes</div>
                <p className="mt-1 whitespace-pre-wrap text-[14px] text-stone-700 [overflow-wrap:anywhere]">{q.notes}</p>
              </div>
            )}
          </section>

          {writing && (
            <AIMessageModal
              quote={{
                id: q.id,
                title: q.title,
                customerName: q.lead?.customer_name ?? "the customer",
                amount: Number(q.amount),
                currency: q.currency,
                status: q.status,
                followUpCount: q.follow_up_count,
                validUntil: q.valid_until,
              }}
              today={today}
              reply={writing === true ? null : writing}
              onClose={() => {
                setWriting(false);
                // A follow-up may have been sent or logged.
                changed.current = true;
                load();
              }}
            />
          )}
        </>
      )}
      {confirmDialog}
    </Modal>
  );
}

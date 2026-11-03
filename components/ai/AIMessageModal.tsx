"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Loader2,
  Mail,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  PenLine,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { CopyButton } from "@/components/ui/CopyButton";
import { AddBusinessEmailButton } from "@/components/ui/AddBusinessEmailButton";
import {
  MESSAGE_TYPES,
  MESSAGE_TYPE_LABELS,
  QUOTE_STATUS_LABELS,
  TONES,
  TONE_LABELS,
  type MessageType,
  type QuoteStatus,
  type Tone,
} from "@/lib/constants";
import type { EmailLogEntry, Message } from "@/lib/types";
import { cn, formatCurrency, formatDate, relativeDay } from "@/lib/utils";
import { suggestMessageType } from "@/lib/follow-up-state";
import { logFollowUpSent } from "@/app/(app)/quotes/actions";
import { sendFollowUpEmail } from "@/app/(app)/quotes/email-actions";
import { addCustomerEmail } from "@/app/(app)/quotes/new-quote-actions";
import { isSampleAddress } from "@/lib/email-address";
import { ReadOnlyNotice, useCanWrite } from "@/components/billing/AccessContext";

type SendOutcome = Awaited<ReturnType<typeof sendFollowUpEmail>>;

export interface AIQuoteContext {
  id: string;
  title: string;
  customerName: string;
  amount: number;
  currency: string;
  status: QuoteStatus;
  followUpCount: number;
  validUntil: string | null;
}

interface LoggedEntry {
  id: string;
  follow_up_number: number;
  completed_at: string | null;
  message_snapshot: string;
}

type HistoryEntry =
  | { kind: "emailed"; id: string; at: string; text: string; to: string; number: number | null }
  | { kind: "logged"; id: string; at: string; text: string; number: number }
  | { kind: "unconfirmed"; id: string; at: string; text: string; to: string }
  | { kind: "failed"; id: string; at: string; to: string }
  | { kind: "draft"; id: string; at: string; text: string; type: MessageType; tone: Tone };

type Banner = { tone: "success" | "warning" | "error" | "info"; text: string };

/** The footer is appended when sending; history shows the message itself. */
function withoutFooter(body: string): string {
  // "--" since November 2026; emails sent before then used an em dash line.
  const i = Math.max(body.lastIndexOf("\n\n--\n"), body.lastIndexOf("\n\n\u2014\n"));
  return i === -1 ? body : body.slice(0, i);
}

export function AIMessageModal({
  quote,
  today,
  onClose,
}: {
  quote: AIQuoteContext;
  /** Viewer's local date from the server. */
  today: string;
  onClose: () => void;
}) {
  const suggested = useMemo(
    () =>
      suggestMessageType(
        { status: quote.status, follow_up_count: quote.followUpCount, valid_until: quote.validUntil },
        today
      ),
    [quote.status, quote.followUpCount, quote.validUntil, today]
  );

  const [messageType, setMessageType] = useState<MessageType>(suggested);
  const canWrite = useCanWrite();
  const [confirm, confirmDialog] = useConfirm();
  const [tone, setTone] = useState<Tone>("friendly");
  const [context, setContext] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [content, setContent] = useState("");
  const [draft, setDraft] = useState("");
  const [subject, setSubject] = useState(`Following up on your quote: ${quote.title}`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Message[]>([]);
  const [logged, setLogged] = useState<LoggedEntry[]>([]);
  const [emails, setEmails] = useState<EmailLogEntry[]>([]);
  const [recipient, setRecipient] = useState<string | null>(null);
  // The quote's customer, so an email address can be added right here.
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [emailEnabled, setEmailEnabled] = useState(false);
  // Replies go to the business email, so sending needs a working one.
  const [replyToReady, setReplyToReady] = useState(true);
  // The reminder this follow-up counts as, as of the last history load.
  const [pendingFollowUpId, setPendingFollowUpId] = useState<string | null>(null);
  const [busy, startAction] = useTransition();
  const [action, setAction] = useState<"send" | "log" | null>(null);
  // Tracked separately: an email can go out while its reminder still needs logging.
  const [emailSent, setEmailSent] = useState(false);
  const [followedUp, setFollowedUp] = useState(false);
  // Sent, but its reminder couldn't be completed: logging by hand stays open.
  const [manualLogNeeded, setManualLogNeeded] = useState(false);
  // The last send had no clear outcome, so sending again could duplicate it.
  const [sendLocked, setSendLocked] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [showAll, setShowAll] = useState(false);

  const firstName = quote.customerName.split(" ")[0] || quote.customerName;
  const edited = content.trim() !== "" && content.trim() !== draft.trim();
  // Demo customers' addresses can never receive mail, so they are never emailed.
  const sampleRecipient = isSampleAddress(recipient);
  const canEmail = emailEnabled && Boolean(recipient) && replyToReady && !sampleRecipient;

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/generate-message?quoteId=${encodeURIComponent(quote.id)}`);
      if (!res.ok) return;
      const data = await res.json();
      setDrafts(data.messages ?? []);
      setLogged(data.logged ?? []);
      setEmails(data.emails ?? []);
      setRecipient(data.recipientEmail ?? null);
      setCustomerId(typeof data.customerId === "string" ? data.customerId : null);
      setEmailEnabled(Boolean(data.emailEnabled));
      setReplyToReady(data.replyToReady !== false);
      setPendingFollowUpId(typeof data.pendingFollowUpId === "string" ? data.pendingFollowUpId : null);
    } catch {
      /* history is optional; the assistant still works without it */
    }
  }, [quote.id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function generate() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/generate-message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quoteId: quote.id, messageType, tone, objection: context }),
      });
      // A proxy error page isn't JSON; never show the parser's complaint.
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.content !== "string") {
        throw new Error(data.error || "QuoteLoop couldn't write a message just now. Please try again, or write one yourself.");
      }
      setContent(data.content);
      setDraft(data.content);
      if (data.fellBack) {
        setNotice(
          `QuoteLoop's AI writer isn't available right now${data.error ? ` (${data.error})` : ""}, so this is a template you can edit.`
        );
      } else if (data.provider === "template") {
        setNotice("No AI key is configured, so this is a template you can edit.");
      }
      if (data.historySaved === false) {
        setError("The message was written but couldn't be saved to history.");
      }
      loadHistory();
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "QuoteLoop couldn't be reached. Check your connection and try again."
          : e instanceof Error
            ? e.message
            : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  const nextReminder = (at: string | null) =>
    at ? `Next reminder ${relativeDay(at, today)}.` : "No more reminders are scheduled for this quote.";

  function sendEmail() {
    if (!content.trim()) return;
    setBanner(null);
    setAction("send");
    startAction(async () => {
      let r: SendOutcome;
      try {
        // Sends the text exactly as it is now — including any edits.
        r = await sendFollowUpEmail({
          quoteId: quote.id,
          subject,
          message: content,
          // Only used to refuse if things changed since this was shown.
          expectedTo: recipient,
          expectedFollowUpId: pendingFollowUpId,
        });
      } catch (e) {
        unstable_rethrow(e); // a redirect Next is handling itself must not be swallowed
        // The request itself broke (connection lost, app restarting), so the
        // email may or may not have gone out.
        r = {
          ok: false,
          unconfirmed: true,
          error: "We couldn't confirm whether the email was sent. Check the history below before sending it again.",
        };
      }
      if (!r.ok) {
        // After an unclear outcome, or when this reminder was already emailed,
        // don't offer a resend that could duplicate it.
        if (r.unconfirmed || r.locked) {
          setSendLocked(true);
          loadHistory();
        }
        // Show the address it would go to now; pressing Send again confirms it.
        if (r.recipientChanged) setRecipient(r.recipientChanged);
        // The business email went missing meanwhile: offer the way to add it.
        if (r.needsBusinessEmail) setReplyToReady(false);
        setBanner({ tone: r.unconfirmed || r.recipientChanged ? "warning" : "error", text: r.error });
        return;
      }
      // Never allow a second send. Logging by hand stays open only when this
      // email's reminder couldn't be recorded.
      setEmailSent(true);
      if (r.followUpLogged) setFollowedUp(true);
      setManualLogNeeded(Boolean(r.needsManualLog));
      const next = r.nextFollowUpAt === undefined ? "" : ` ${nextReminder(r.nextFollowUpAt)}`;
      const summary = r.followUpLogged
        ? `Email sent to ${r.recipient} and follow-up #${r.followUpNumber} logged.${next}`
        : `Email sent to ${r.recipient}.`;
      setBanner(
        r.warning
          ? { tone: "warning", text: `${summary} ${r.warning}` }
          : { tone: "success", text: summary }
      );
      loadHistory();
    });
  }

  function markFollowedUp() {
    setBanner(null);
    setAction("log");
    startAction(async () => {
      // Logs the text as it is now — including any edits — not the AI draft.
      let result: Awaited<ReturnType<typeof logFollowUpSent>>;
      try {
        result = await logFollowUpSent(quote.id, content || null, pendingFollowUpId);
      } catch (e) {
        unstable_rethrow(e); // a redirect Next is handling itself must not be swallowed
        setBanner({
          tone: "error",
          text: "That didn't go through, so nothing was logged. You may have lost your connection, or been signed out in another tab. Refresh the page and try again.",
        });
        return;
      }
      if (result.logged) {
        setFollowedUp(true);
        setBanner({
          tone: "success",
          text:
            `Logged as follow-up #${result.followUpNumber}. ${nextReminder(result.nextFollowUpAt ?? null)}` +
            (edited ? " Your edited text was saved as the message used." : ""),
        });
        loadHistory();
      } else {
        setBanner({ tone: result.failed ? "error" : "info", text: result.message ?? "Nothing was logged." });
        loadHistory();
      }
    });
  }

  // History: emailed follow-ups, manually logged follow-ups, unconfirmed and
  // failed sends, drafts. A sent email is shown once, on the reminder it completed.
  const mergedEmails = new Set<string>();
  const history: HistoryEntry[] = [
    ...logged.map((l): HistoryEntry => {
      const email = emails.find(
        (e) => e.status === "sent" && e.follow_up_id === l.id && !mergedEmails.has(e.id)
      );
      if (!email) {
        return { kind: "logged", id: `l-${l.id}`, at: l.completed_at ?? "", text: l.message_snapshot, number: l.follow_up_number };
      }
      mergedEmails.add(email.id);
      return { kind: "emailed", id: `l-${l.id}`, at: l.completed_at ?? email.created_at, text: l.message_snapshot, to: email.recipient_email, number: l.follow_up_number };
    }),
    ...emails
      .filter((e) => !mergedEmails.has(e.id))
      .map((e): HistoryEntry =>
        e.status === "sent"
          ? { kind: "emailed", id: `e-${e.id}`, at: e.sent_at ?? e.created_at, text: withoutFooter(e.body), to: e.recipient_email, number: null }
          : e.status === "pending"
            ? { kind: "unconfirmed", id: `e-${e.id}`, at: e.created_at, text: withoutFooter(e.body), to: e.recipient_email }
            : { kind: "failed", id: `e-${e.id}`, at: e.created_at, to: e.recipient_email }
      ),
    ...drafts.map((m): HistoryEntry => ({
      kind: "draft",
      id: `d-${m.id}`,
      at: m.created_at,
      text: m.content,
      type: m.message_type,
      tone: m.tone,
    })),
  ].sort((a, b) => Date.parse(b.at || "0") - Date.parse(a.at || "0"));
  const visibleHistory = showAll ? history : history.slice(0, 3);

  const bannerStyle: Record<Banner["tone"], string> = {
    success: "border-emerald-600 bg-white",
    warning: "border-brand-400 bg-brand-50",
    error: "border-red-600 bg-white",
    info: "border-stone-300 bg-stone-50",
  };

  return (
    <Modal
      open
      onClose={async () => {
        // Closing mid-send would hide whether the email went out.
        if (busy || loading) return;
        if (
          edited &&
          !emailSent &&
          !followedUp &&
          !(await confirm({
            title: "Close without using your message?",
            message: "Your edited message won't be kept.",
            confirmLabel: "Discard message",
            cancelLabel: "Keep editing",
            danger: true,
          }))
        )
          return;
        onClose();
      }}
      size="lg"
      title={`Follow up with ${firstName}`}
      description={
        <span className="flex flex-wrap items-baseline gap-x-3">
          <span className="[overflow-wrap:anywhere]">{quote.title}</span>
          <span className="num font-semibold text-stone-900">
            {formatCurrency(quote.amount, quote.currency)}
          </span>
          <span>{QUOTE_STATUS_LABELS[quote.status]}</span>
        </span>
      }
    >
      <ReadOnlyNotice />
      <div className="space-y-4">
        {/* What will be written, with options tucked away */}
        <div className="border-b border-stone-200 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[15px]">
            <span className="text-stone-700">
              <span className="font-semibold text-stone-900">{MESSAGE_TYPE_LABELS[messageType]}</span>
              {", "}
              {TONE_LABELS[tone].toLowerCase()} tone
              {messageType === suggested && (
                <span className="ml-2 text-stone-500">suggested for this quote</span>
              )}
            </span>
            <button
              type="button"
              className="btn-ghost tap px-2 py-1 text-[15px]"
              onClick={() => setAdjusting((a) => !a)}
              aria-expanded={adjusting}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {adjusting ? "Hide options" : "Adjust"}
            </button>
          </div>
          {adjusting && (
            <div className="ql-in mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="ai-type">Message</label>
                <select
                  id="ai-type"
                  className="input"
                  value={messageType}
                  onChange={(e) => setMessageType(e.target.value as MessageType)}
                >
                  {MESSAGE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {MESSAGE_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="ai-tone">Tone</label>
                <select
                  id="ai-tone"
                  className="input"
                  value={tone}
                  onChange={(e) => setTone(e.target.value as Tone)}
                >
                  {TONES.map((t) => (
                    <option key={t} value={t}>
                      {TONE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="ai-context">
                  {messageType === "objection_response"
                    ? "What did the customer say?"
                    : "Anything to mention? (optional)"}
                </label>
                <input
                  id="ai-context"
                  className="input"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g. They said the price is higher than expected"
                />
              </div>
            </div>
          )}
        </div>

        {/* The draft */}
        {!content && !loading && (
          <div className="ql-fade py-2">
            <button className="btn-primary px-4 py-2.5 text-base" onClick={generate} disabled={!canWrite}>
              <PenLine className="h-4 w-4" /> Draft follow-up for {firstName}
            </button>
            <p className="mt-2 max-w-prose text-[15px] text-stone-600">
              Written from this quote&apos;s details. You review it; nothing is sent until you choose to.
            </p>
          </div>
        )}

        {loading && (
          <div className="ql-fade space-y-2.5 rounded-[6px] border border-stone-300 p-4" aria-live="polite">
            <div className="flex items-center gap-2 text-[15px] text-stone-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Writing a draft…
            </div>
            <div className="h-3.5 w-11/12 rounded-[3px] bg-stone-100" />
            <div className="h-3.5 w-9/12 rounded-[3px] bg-stone-100" />
            <div className="h-3.5 w-10/12 rounded-[3px] bg-stone-100" />
          </div>
        )}

        {content && !loading && (
          <div className="ql-fade space-y-3">
            {/* Where the To line goes once there's an address: add one right here. */}
            {emailEnabled && replyToReady && !recipient && customerId && (
              <InlineCustomerEmail customerId={customerId} name={firstName} onSaved={loadHistory} />
            )}
            {canEmail && (
              <div className="divide-y divide-stone-200 rounded-[6px] border border-stone-400 text-[15px]">
                <div className="flex items-start gap-3 px-3 py-2">
                  <span className="w-16 shrink-0 text-stone-600">To</span>
                  {/* Wraps rather than truncates: the whole address must be checkable. */}
                  <span className="min-w-0 font-semibold text-stone-900 [overflow-wrap:anywhere]">{recipient}</span>
                </div>
                <div className="flex items-center gap-3 px-3 py-1.5">
                  <label htmlFor="ai-subject" className="w-16 shrink-0 text-stone-600">Subject</label>
                  <input
                    id="ai-subject"
                    className="w-full bg-transparent py-0.5 text-base text-stone-900 focus:outline-none"
                    value={subject}
                    maxLength={200}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
              </div>
            )}
            <div className="relative">
              <textarea
                aria-label="Follow-up message"
                className="input min-h-[190px] resize-y leading-relaxed"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              {edited && (
                <span className="ql-pop absolute right-2 top-2 rounded-[4px] bg-brand-200 px-1.5 py-0.5 text-[13px] font-semibold text-stone-900">
                  Edited
                </span>
              )}
            </div>
            <p className="flex items-center gap-1.5 text-[15px] text-stone-600">
              <ShieldCheck className="h-4 w-4 shrink-0 text-stone-500" />
              {canEmail
                ? "Review before sending. It's only emailed when you click Send email."
                : "Review before sending. Copy it into your own email or phone."}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              {canEmail && (
                <button
                  className="btn-primary"
                  onClick={sendEmail}
                  disabled={busy || !content.trim() || emailSent || followedUp || sendLocked}
                >
                  {busy && action === "send" ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                  ) : emailSent ? (
                    <><Check className="h-4 w-4" /> Email sent</>
                  ) : (
                    <><Mail className="h-4 w-4" /> Send email</>
                  )}
                </button>
              )}
              <CopyButton
                text={content}
                label="Copy message"
                className={canEmail ? "btn-secondary" : "btn-primary"}
              />
              <button
                className={canEmail ? "btn-ghost" : "btn-secondary"}
                onClick={markFollowedUp}
                disabled={busy || followedUp || (emailSent && !manualLogNeeded)}
                title="Record that you sent this yourself"
              >
                {busy && action === "log" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : followedUp ? (
                  <Check className="h-4 w-4 text-emerald-700" />
                ) : null}
                {followedUp ? "Followed up" : "Mark as followed up"}
              </button>
              <button className="btn-ghost ml-auto" onClick={generate} disabled={busy}>
                <RotateCcw className="h-4 w-4" /> Rewrite
              </button>
            </div>

            {!canEmail &&
              (!emailEnabled ? (
                <p className="text-[15px] text-stone-600">
                  Email sending isn&apos;t set up for this workspace, so copy the message and send it yourself.
                </p>
              ) : (
                <div className="space-y-2">
                  {!replyToReady && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[6px] border-2 border-brand-400 bg-brand-50 px-3 py-2 text-[15px] text-stone-900">
                      <span>Add your business email in Settings before sending from QuoteLoop.</span>
                      <AddBusinessEmailButton
                        unsaved={edited && !emailSent && !followedUp}
                        className="btn-secondary px-2.5 py-1.5"
                      />
                    </div>
                  )}
                  {sampleRecipient && (
                    <p className="rounded-[6px] border border-stone-300 bg-stone-50 px-3 py-2 text-[15px] text-stone-800">
                      This is a sample customer from the demo data, so QuoteLoop won&apos;t email them. Copy the
                      message to try it out.
                    </p>
                  )}
                  {!recipient && !customerId && (
                    <p className="text-[15px] text-stone-600">
                      Add an email address to this customer to send from QuoteLoop.{" "}
                      <Link href="/leads" className="font-medium text-info-700 hover:underline">
                        Open Customers
                      </Link>
                    </p>
                  )}
                </div>
              ))}

            {banner && (
              <div className={cn("ql-fade rounded-[6px] border-2 px-3 py-2 text-[15px] text-stone-900", bannerStyle[banner.tone])} role="status">
                {banner.text}
              </div>
            )}
          </div>
        )}

        {notice && (
          <div className="ql-fade flex items-start gap-2 rounded-[6px] border-2 border-brand-400 bg-brand-50 px-3 py-2 text-[15px] text-stone-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}
        {error && (
          <div className="ql-fade rounded-[6px] border-2 border-red-600 px-3 py-2 text-[15px] font-medium text-red-700">
            {error}
          </div>
        )}

        {/* History */}
        <div className="border-t border-stone-200 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[16px] font-semibold text-stone-900">History</h3>
            {history.length > 3 && (
              <button className="tap inline-flex items-center justify-end text-[15px] font-medium text-info-700 hover:underline" onClick={() => setShowAll((s) => !s)}>
                {showAll ? "Show less" : `Show all ${history.length}`}
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-[15px] text-stone-600">
              Messages you draft will appear here for reference. When you send or log
              one, the exact text you used is kept.
            </p>
          ) : (
            <ul className="space-y-3">
              {visibleHistory.map((h) => (
                <li
                  key={h.id}
                  className={cn(
                    "border-l-2 pl-3",
                    h.kind === "emailed" || h.kind === "logged"
                      ? "border-emerald-600"
                      : h.kind === "unconfirmed"
                        ? "border-brand-400"
                        : h.kind === "failed"
                          ? "border-red-600"
                          : "border-stone-300"
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2 text-[14px]">
                    {h.kind === "emailed" ? (
                      <span className="min-w-0 font-semibold text-emerald-700 [overflow-wrap:anywhere]">
                        Email sent to {h.to}, final text used
                        {h.number ? ` (follow-up ${h.number})` : ""}
                      </span>
                    ) : h.kind === "logged" ? (
                      <span className="font-semibold text-emerald-700">
                        Follow-up {h.number} logged, final text used
                      </span>
                    ) : h.kind === "unconfirmed" ? (
                      <span className="min-w-0 font-semibold text-stone-900 [overflow-wrap:anywhere]">
                        Email to {h.to}: delivery not confirmed
                      </span>
                    ) : h.kind === "failed" ? (
                      <span className="min-w-0 font-semibold text-red-700 [overflow-wrap:anywhere]">
                        Email to {h.to} failed, no follow-up recorded
                      </span>
                    ) : (
                      <span className="font-medium text-stone-600">
                        Draft: {MESSAGE_TYPE_LABELS[h.type]}, {TONE_LABELS[h.tone].toLowerCase()} tone
                      </span>
                    )}
                    <span className="num shrink-0 text-stone-600">{formatDate(h.at)}</span>
                  </div>
                  {h.kind !== "failed" && (
                    <>
                      <p
                        className={cn(
                          "mt-1 line-clamp-4 whitespace-pre-wrap text-[15px]",
                          h.kind === "draft" ? "text-stone-600" : "text-stone-900"
                        )}
                      >
                        {h.text}
                      </p>
                      {/* The entry above is cut to four lines, so a failed copy shows all of it. */}
                      <CopyButton
                        text={h.text}
                        label="Copy"
                        showTextOnFail
                        className="btn-ghost tap -ml-2 mt-0.5 px-2 py-0.5 text-[14px]"
                      />
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {confirmDialog}
    </Modal>
  );
}

/**
 * Saves an email address for a customer who has none, inside the follow-up
 * window, so Send email appears without leaving it. The saved address is what
 * the server sends to; the browser never supplies the recipient at send time.
 */
function InlineCustomerEmail({
  customerId,
  name,
  onSaved,
}: {
  customerId: string;
  name: string;
  onSaved: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function save() {
    // Enter pressed again while saving must not save twice.
    if (busy || !email.trim()) return;
    setError(null);
    start(async () => {
      try {
        const outcome = await addCustomerEmail(customerId, email.trim());
        if (!outcome.ok) return setError(outcome.error);
        await onSaved();
      } catch (e) {
        unstable_rethrow(e); // a redirect Next is handling itself must not be swallowed
        setError("QuoteLoop couldn't be reached, so the email address may not have been saved. Check your connection and try again.");
      }
    });
  }

  return (
    <div className="rounded-[6px] border-2 border-stone-900 p-3">
      <label htmlFor="ai-add-email" className="label">
        Add {name}&apos;s email to send this from QuoteLoop
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          id="ai-add-email"
          type="email"
          inputMode="email"
          autoComplete="off"
          className="input min-w-0 flex-1 basis-48"
          placeholder="name@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
        />
        <button type="button" className="btn-primary" onClick={save} disabled={busy || !email.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Save email
        </button>
      </div>
      <p className="mt-1 text-[15px] text-stone-600">Saved to this customer, so later follow-ups can be emailed too.</p>
      {error && (
        <p role="alert" className="mt-1 text-[15px] font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

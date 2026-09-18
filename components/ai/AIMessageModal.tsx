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
  Sparkles,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
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
  const i = body.lastIndexOf("\n\n—\n");
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
  const canEmail = emailEnabled && Boolean(recipient) && replyToReady;

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/generate-message?quoteId=${encodeURIComponent(quote.id)}`);
      if (!res.ok) return;
      const data = await res.json();
      setDrafts(data.messages ?? []);
      setLogged(data.logged ?? []);
      setEmails(data.emails ?? []);
      setRecipient(data.recipientEmail ?? null);
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
          text: "That didn't go through, so nothing was logged. You may have lost your connection, or been signed out in another tab — refresh the page and try again.",
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
    success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    warning: "bg-amber-50 text-amber-900 ring-amber-200",
    error: "bg-red-50 text-red-800 ring-red-200",
    info: "bg-stone-100 text-stone-700 ring-stone-200",
  };

  return (
    <Modal
      open
      onClose={() => {
        // Closing mid-send would hide whether the email went out.
        if (busy || loading) return;
        if (edited && !emailSent && !followedUp && !window.confirm("Close without using your edited message?")) return;
        onClose();
      }}
      size="lg"
      title={`Follow up with ${firstName}`}
      description={
        <span>
          {quote.title} ·{" "}
          <span className="num font-medium text-stone-700">
            {formatCurrency(quote.amount, quote.currency)}
          </span>{" "}
          · {QUOTE_STATUS_LABELS[quote.status]}
        </span>
      }
    >
      <div className="space-y-4">
        {/* What will be written, with options tucked away */}
        <div className="rounded-md bg-stone-50 px-3 py-2.5 ring-1 ring-inset ring-stone-200">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-stone-600">
              <span className="font-medium text-stone-900">{MESSAGE_TYPE_LABELS[messageType]}</span>
              {" · "}
              {TONE_LABELS[tone]}
              {messageType === suggested && (
                <span className="ml-1.5 text-xs text-stone-400">suggested for this quote</span>
              )}
            </span>
            <button
              type="button"
              className="btn-ghost tap px-2 py-1 text-xs"
              onClick={() => setAdjusting((a) => !a)}
              aria-expanded={adjusting}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {adjusting ? "Hide options" : "Adjust"}
            </button>
          </div>
          {adjusting && (
            <div className="mt-3 grid gap-3 border-t border-stone-200 pt-3 sm:grid-cols-2">
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
          <div className="flex flex-col items-center rounded-md border border-dashed border-stone-300 px-6 py-8 text-center">
            <button className="btn-accent px-4 py-2" onClick={generate}>
              <Sparkles className="h-4 w-4" /> Draft follow-up for {firstName}
            </button>
            <p className="mt-2 text-xs text-stone-500">
              Written from this quote&apos;s details. You review it; nothing is sent until you choose to.
            </p>
          </div>
        )}

        {loading && (
          <div className="space-y-2 rounded-md border border-stone-200 p-4" aria-live="polite">
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Writing a draft…
            </div>
            <div className="h-3 w-11/12 animate-pulse rounded bg-stone-100" />
            <div className="h-3 w-9/12 animate-pulse rounded bg-stone-100" />
            <div className="h-3 w-10/12 animate-pulse rounded bg-stone-100" />
          </div>
        )}

        {content && !loading && (
          <div className="space-y-3">
            {canEmail && (
              <div className="divide-y divide-stone-100 rounded-md border border-stone-200 text-sm">
                <div className="flex items-start gap-3 px-3 py-2">
                  <span className="w-14 shrink-0 text-stone-500">To</span>
                  {/* Wraps rather than truncates: the whole address must be checkable. */}
                  <span className="min-w-0 font-medium text-stone-800 [overflow-wrap:anywhere]">{recipient}</span>
                </div>
                <div className="flex items-center gap-3 px-3 py-1.5">
                  <label htmlFor="ai-subject" className="w-14 shrink-0 text-stone-500">Subject</label>
                  <input
                    id="ai-subject"
                    className="w-full bg-transparent py-0.5 text-stone-800 focus:outline-none"
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
                <span className="absolute right-2 top-2 rounded bg-stone-900 px-1.5 py-0.5 text-[11px] font-medium text-white">
                  Edited
                </span>
              )}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-stone-500">
              <ShieldCheck className="h-3.5 w-3.5 text-stone-400" />
              {canEmail
                ? "Review before sending. It's only emailed when you click Send email."
                : "Review before sending. Copy it into your own email or phone."}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              {canEmail && (
                <button
                  className="btn-accent"
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
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : null}
                {followedUp ? "Followed up" : "Mark as followed up"}
              </button>
              <button className="btn-ghost ml-auto" onClick={generate} disabled={busy}>
                <RotateCcw className="h-4 w-4" /> Rewrite
              </button>
            </div>

            {!canEmail &&
              (!emailEnabled ? (
                <p className="text-xs text-stone-500">
                  Email sending isn&apos;t set up for this workspace, so copy the message and send it yourself.
                </p>
              ) : (
                <div className="space-y-2">
                  {!replyToReady && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
                      <span>Add your business email in Settings before sending from QuoteLoop.</span>
                      <AddBusinessEmailButton
                        unsaved={edited && !emailSent && !followedUp}
                        className="btn-secondary px-2.5 py-1 text-xs"
                      />
                    </div>
                  )}
                  {!recipient && (
                    <p className="text-xs text-stone-500">
                      Add an email address to this customer to send from QuoteLoop.{" "}
                      <Link href="/leads" className="font-medium text-stone-700 underline-offset-2 hover:underline">
                        Open Customers
                      </Link>
                    </p>
                  )}
                </div>
              ))}

            {banner && (
              <div className={cn("rounded-md px-3 py-2 text-sm ring-1 ring-inset", bannerStyle[banner.tone])} role="status">
                {banner.text}
              </div>
            )}
          </div>
        )}

        {notice && (
          <div className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}
        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-inset ring-red-200">
            {error}
          </div>
        )}

        {/* History */}
        <div className="border-t border-stone-200 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="eyebrow">History</span>
            {history.length > 3 && (
              <button className="tap inline-flex items-center justify-end text-xs font-medium text-stone-500 hover:text-stone-900" onClick={() => setShowAll((s) => !s)}>
                {showAll ? "Show less" : `Show all ${history.length}`}
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-stone-500">
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
                      ? "border-emerald-500"
                      : h.kind === "unconfirmed"
                        ? "border-amber-400"
                        : h.kind === "failed"
                          ? "border-red-300"
                          : "border-stone-200"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    {h.kind === "emailed" ? (
                      <span className="truncate font-semibold text-emerald-800">
                        Email sent to {h.to} · final text used
                        {h.number ? ` · follow-up #${h.number}` : ""}
                      </span>
                    ) : h.kind === "logged" ? (
                      <span className="font-semibold text-emerald-800">
                        Logged follow-up #{h.number} · final text used
                      </span>
                    ) : h.kind === "unconfirmed" ? (
                      <span className="truncate font-medium text-amber-800">
                        Email to {h.to} · delivery not confirmed
                      </span>
                    ) : h.kind === "failed" ? (
                      <span className="truncate font-medium text-red-700">
                        Email to {h.to} failed · no follow-up recorded
                      </span>
                    ) : (
                      <span className="font-medium text-stone-500">
                        Generated draft · {MESSAGE_TYPE_LABELS[h.type]} · {TONE_LABELS[h.tone]}
                      </span>
                    )}
                    <span className="shrink-0 text-stone-400">{formatDate(h.at)}</span>
                  </div>
                  {h.kind !== "failed" && (
                    <>
                      <p
                        className={cn(
                          "mt-1 line-clamp-4 whitespace-pre-wrap text-sm",
                          h.kind === "draft" ? "text-stone-500" : "text-stone-800"
                        )}
                      >
                        {h.text}
                      </p>
                      {/* The entry above is cut to four lines, so a failed copy shows all of it. */}
                      <CopyButton
                        text={h.text}
                        label="Copy"
                        showTextOnFail
                        className="btn-ghost tap -ml-2 mt-0.5 px-2 py-0.5 text-xs"
                      />
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

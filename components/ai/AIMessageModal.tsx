"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Loader2,
  Mail,
  ChevronDown,
  SlidersHorizontal,
  PenLine,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { CopyButton } from "@/components/ui/CopyButton";
import { AddBusinessEmailButton } from "@/components/ui/AddBusinessEmailButton";
import { AttachFiles, toAttachmentInputs, type PickedFile } from "@/components/ui/AttachFiles";
import {
  MESSAGE_TYPES,
  MESSAGE_TYPE_LABELS,
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
import { fillSubject, fillTemplate, signatureParts, templateForStep, type ResolvedTemplate, type TemplateValues } from "@/lib/templates";

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

/** A customer's reply being answered from QuoteLoop. */
export interface ReplyContext {
  /** customer_replies.id: the answer threads with it. */
  id: string;
  subject: string | null;
  /** Who wrote it. */
  from: string;
  /** What they wrote this time. */
  text: string;
}

export function AIMessageModal({
  quote,
  today,
  onClose,
  reply = null,
}: {
  quote: AIQuoteContext;
  /** Viewer's local date from the server. */
  today: string;
  onClose: () => void;
  /** Answering this reply instead of writing a follow-up. */
  reply?: ReplyContext | null;
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
  // PDFs and photos sent with the email (not with a copied message).
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [subject, setSubject] = useState(() =>
    reply
      ? `${/^re:/i.test(reply.subject ?? "") ? "" : "Re: "}${reply.subject || `Your quote: ${quote.title}`}`.slice(0, 200)
      : `Following up on your quote: ${quote.title}`
  );
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
  // Sent, logged or an address saved: the page underneath reloads on close
  // (the actions don't refresh it themselves; see email-actions.ts).
  const changed = useRef(false);
  // null: folded unless an entry needs attention; then whatever the user chose.
  const [showHistory, setShowHistory] = useState<boolean | null>(null);
  const [templates, setTemplates] = useState<ResolvedTemplate[]>([]);
  const [templateValues, setTemplateValues] = useState<TemplateValues | null>(null);
  // The template the message came from, if it did (not an AI draft).
  const [templateId, setTemplateId] = useState<string | null>(null);
  // The first history load fills in this step's template, once.
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const prefilled = useRef(false);

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
      const list: ResolvedTemplate[] = Array.isArray(data.templates) ? data.templates : [];
      const values: TemplateValues | null = data.templateValues ?? null;
      setTemplates(list);
      setTemplateValues(values);
      // Open with the message for this step already written; the AI can
      // rewrite it. Only on the first load, before anything was typed.
      if (!prefilled.current && values) {
        prefilled.current = true;
        if (reply) {
          // An answer starts with the greeting and sign-off; the middle is yours.
          const { signOff, signature } = signatureParts(values);
          const first = values.customerName.trim().split(/\s+/)[0] || "there";
          const start = `Hi ${first},\n\n\n\n${signOff}\n${signature}`;
          setContent(start);
          setDraft(start);
        } else {
          const t = templateForStep(suggested, list);
          if (t) fillFrom(t, values);
        }
      }
    } catch {
      /* history is optional; the assistant still works without it */
    } finally {
      setHistoryLoaded(true);
    }
    // fillFrom only uses state setters; suggested is fixed while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // Answering a reply: the AI responds to what the customer wrote.
        body: JSON.stringify(
          reply
            ? {
                quoteId: quote.id,
                messageType: "objection_response",
                tone,
                objection: (context.trim() ? `${reply.text}\n\nAlso mention: ${context.trim()}` : reply.text).slice(0, 1500),
              }
            : { quoteId: quote.id, messageType, tone, objection: context }
        ),
      });
      // A proxy error page isn't JSON; never show the parser's complaint.
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.content !== "string") {
        throw new Error(data.error || "QuoteLoop couldn't write a message just now. Please try again, or write one yourself.");
      }
      setContent(data.content);
      setDraft(data.content);
      setTemplateId(null);
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

  /** Fills the message (and subject, if the template has one) from a template. */
  function fillFrom(t: ResolvedTemplate, values: TemplateValues) {
    const text = fillTemplate(t.body, values);
    setContent(text);
    setDraft(text);
    const filled = fillSubject(t.subject, values);
    if (filled) setSubject(filled);
    setTemplateId(t.id);
    if (t.messageType) setMessageType(t.messageType);
    setNotice(null);
    setError(null);
  }

  /** Picked from the menu: asks before replacing edited text. */
  async function applyTemplate(t: ResolvedTemplate) {
    if (!templateValues) return;
    if (
      edited &&
      !(await confirm({
        title: "Replace your message?",
        message: "The message is rewritten with the template you picked. Your edits to it won't be kept.",
        confirmLabel: "Replace message",
        cancelLabel: "Keep my message",
      }))
    )
      return;
    fillFrom(t, templateValues);
  }

  /** A different step chosen under Adjust: untouched template text follows it. */
  function chooseType(next: MessageType) {
    setMessageType(next);
    const current = templates.find((t) => t.id === templateId);
    if (!current?.builtinKey || edited || emailSent || followedUp || !templateValues) return;
    const t = templateForStep(next, templates);
    if (t) fillFrom(t, templateValues);
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
          inReplyTo: reply?.id ?? null,
          attachments: toAttachmentInputs(files),
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


  // The picker lists every template; an AI draft shows as its own choice.
  const readyMade = templates.filter((t) => t.builtinKey);
  const ownTemplates = templates.filter((t) => !t.builtinKey);
  const pickTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (t) applyTemplate(t);
  };
  const locked = busy || emailSent || followedUp;
  const attention = history.some((h) => h.kind === "unconfirmed" || h.kind === "failed");
  const historyOpen = showHistory ?? attention;
  const messageBox = (tone: Banner["tone"]) =>
    tone === "success" ? "msg-success" : tone === "warning" ? "msg-warn" : tone === "error" ? "msg-error" : "msg-info";

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
        if (changed.current || emailSent || followedUp) window.location.reload();
      }}
      size="lg"
      title={reply ? `Reply to ${firstName}` : `Follow up with ${firstName}`}
      description={
        <span className="[overflow-wrap:anywhere]">
          {quote.title}, <span className="num font-medium text-stone-900">{formatCurrency(quote.amount, quote.currency)}</span>
        </span>
      }
    >
      <ReadOnlyNotice />
      <div className="flex flex-col gap-4">
        {/* One choice: which message. The AI is one button away. */}
        {/* Answering a reply: what they wrote, then the AI is one button away. */}
        {reply && (
          <div>
            <blockquote className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-[10px] border-l-4 border-info-500 bg-canvas px-3 py-2 text-[14px] text-stone-700 [overflow-wrap:anywhere]">
              <span className="mb-1 block text-[12px] font-medium text-stone-500">{reply.from} wrote:</span>
              {reply.text || reply.subject || "(No text)"}
            </blockquote>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className="btn-secondary" onClick={generate} disabled={busy || loading || !canWrite}>
                <PenLine className="h-4 w-4" /> Write with AI
              </button>
              <button
                type="button"
                className="btn-ghost tap px-2"
                onClick={() => setAdjusting((a) => !a)}
                aria-expanded={adjusting}
                aria-label="AI options"
                title="AI options"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            </div>
            {adjusting && aiOptions()}
          </div>
        )}
        {!reply && templates.length > 0 && (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                id="ai-wording"
                aria-label="Message"
                className="input min-w-0 flex-1 basis-56"
                value={templateId ?? ""}
                disabled={locked || loading}
                onChange={(e) => pickTemplate(e.target.value)}
              >
                {!templateId && <option value="">{content ? "AI draft" : "Choose a message"}</option>}
                <optgroup label="QuoteLoop templates">
                  {readyMade.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
                {ownTemplates.length > 0 && (
                  <optgroup label="Your templates">
                    {ownTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <button className="btn-secondary" onClick={generate} disabled={busy || loading || !canWrite}>
                <PenLine className="h-4 w-4" /> Write with AI
              </button>
              <button
                type="button"
                className="btn-ghost tap px-2"
                onClick={() => setAdjusting((a) => !a)}
                aria-expanded={adjusting}
                aria-label="AI options"
                title="AI options"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            </div>
            {adjusting && aiOptions()}
          </div>
        )}

        {/* Without templates (they couldn't load): the AI button, as before. */}
        {!content && !loading && !historyLoaded && (
          <div className="space-y-2.5 rounded-[12px] border border-line p-4" aria-live="polite">
            <div className="flex items-center gap-2 text-[15px] text-stone-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Getting your message ready…
            </div>
            <div className="h-3.5 w-11/12 rounded-[3px] bg-stone-100" />
            <div className="h-3.5 w-9/12 rounded-[3px] bg-stone-100" />
          </div>
        )}
        {!content && !loading && historyLoaded && templates.length === 0 && (
          <div className="ql-fade py-2">
            <button className="btn-primary px-4 py-2.5 text-base" onClick={generate} disabled={!canWrite}>
              <PenLine className="h-4 w-4" /> Draft follow-up for {firstName}
            </button>
            <button
              type="button"
              className="btn-ghost tap ml-2 px-2"
              onClick={() => setAdjusting((a) => !a)}
              aria-expanded={adjusting}
              aria-label="AI options"
              title="AI options"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            {adjusting && aiOptions()}
          </div>
        )}

        {loading && (
          <div className="ql-fade space-y-2.5 rounded-[12px] border border-line p-4" aria-live="polite">
            <div className="flex items-center gap-2 text-[15px] text-stone-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Writing a draft…
            </div>
            <div className="h-3.5 w-11/12 rounded-[3px] bg-stone-100" />
            <div className="h-3.5 w-9/12 rounded-[3px] bg-stone-100" />
            <div className="h-3.5 w-10/12 rounded-[3px] bg-stone-100" />
          </div>
        )}

        {content && !loading && (
          <div className="ql-fade flex flex-col gap-3">
            {/* Where the To line goes once there's an address: add one right here. */}
            {emailEnabled && replyToReady && !recipient && customerId && (
              <InlineCustomerEmail
                customerId={customerId}
                name={firstName}
                onSaved={async () => {
                  changed.current = true;
                  await loadHistory();
                }}
              />
            )}
            {canEmail && (
              <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-y-1 text-[15px]">
                <dt className="text-stone-500">To</dt>
                {/* Wraps rather than truncates: the whole address must be checkable. */}
                <dd className="font-medium text-stone-900 [overflow-wrap:anywhere]">{recipient}</dd>
                <dt>
                  <label htmlFor="ai-subject" className="text-stone-500">
                    Subject
                  </label>
                </dt>
                <dd>
                  <input
                    id="ai-subject"
                    className="w-full border-b border-line bg-transparent py-1 text-base text-stone-900 focus:border-info-500 focus:outline-none"
                    value={subject}
                    maxLength={200}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </dd>
              </dl>
            )}
            <div className="relative">
              <textarea
                aria-label="Follow-up message"
                className="input min-h-[200px] resize-y leading-relaxed"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              {edited && <span className="chip-muted ql-pop absolute right-2 top-2">Edited</span>}
            </div>
            {canEmail && <AttachFiles files={files} onChange={setFiles} disabled={busy || emailSent || followedUp} />}

            {!canEmail &&
              (!emailEnabled ? (
                <p className="text-[14px] text-stone-500">
                  Email sending isn&apos;t set up for this workspace, so copy the message and send it yourself.
                </p>
              ) : (
                <>
                  {!replyToReady && (
                    <div className="msg-warn flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span>Add your business email in Settings before sending from QuoteLoop.</span>
                      <AddBusinessEmailButton unsaved={edited && !emailSent && !followedUp} className="btn-secondary px-2.5 py-1.5" />
                    </div>
                  )}
                  {sampleRecipient && (
                    <p className="msg-info">
                      This is a sample customer from the demo data, so QuoteLoop won&apos;t email them. Copy the message
                      to try it out.
                    </p>
                  )}
                  {!recipient && !customerId && (
                    <p className="text-[14px] text-stone-500">
                      Add an email address to this customer to send from QuoteLoop.{" "}
                      <Link href="/leads" className="font-medium text-info-700 hover:underline">
                        Open Customers
                      </Link>
                    </p>
                  )}
                </>
              ))}

            {/* Send on the right; recording it yourself on the left. */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
              <button
                className={reply ? "invisible" : "btn-ghost"}
                aria-hidden={reply ? true : undefined}
                tabIndex={reply ? -1 : undefined}
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
              <div className="flex flex-wrap items-center gap-2">
                <CopyButton text={content} label="Copy message" className={canEmail ? "btn-secondary" : "btn-primary"} />
                {canEmail && (
                  <button
                    className="btn-primary"
                    onClick={sendEmail}
                    disabled={busy || !content.trim() || emailSent || followedUp || sendLocked}
                  >
                    {busy && action === "send" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                      </>
                    ) : emailSent ? (
                      <>
                        <Check className="h-4 w-4" /> Email sent
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4" /> Send email
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {banner && (
              <div className={cn("ql-fade", messageBox(banner.tone))} role="status">
                {banner.text}
              </div>
            )}
          </div>
        )}

        {notice && (
          <div className="msg-warn ql-fade flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}
        {error && <div className="msg-error ql-fade">{error}</div>}

        {/* History: folded away unless something in it needs a look. */}
        {history.length > 0 && (
          <div className="border-t border-line pt-3">
            <button
              type="button"
              className="tap inline-flex items-center gap-1.5 text-[14px] font-medium text-stone-700 hover:text-stone-900"
              aria-expanded={historyOpen}
              onClick={() => setShowHistory(!historyOpen)}
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", historyOpen ? "" : "-rotate-90")} />
              History ({history.length})
            </button>
            {historyOpen && (
              <ul className="mt-3 space-y-3">
                {(showAll ? history : history.slice(0, 3)).map((h) => (
                  <li
                    key={h.id}
                    className={cn(
                      "border-l-2 pl-3",
                      h.kind === "emailed" || h.kind === "logged"
                        ? "border-emerald-600"
                        : h.kind === "unconfirmed"
                          ? "border-due-500"
                          : h.kind === "failed"
                            ? "border-red-600"
                            : "border-stone-300"
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2 text-[14px]">
                      {h.kind === "emailed" ? (
                        <span className="min-w-0 font-medium text-emerald-700 [overflow-wrap:anywhere]">
                          Email sent to {h.to}, final text used
                          {h.number ? ` (follow-up ${h.number})` : ""}
                        </span>
                      ) : h.kind === "logged" ? (
                        <span className="font-medium text-emerald-700">Follow-up {h.number} logged, final text used</span>
                      ) : h.kind === "unconfirmed" ? (
                        <span className="min-w-0 font-medium text-stone-900 [overflow-wrap:anywhere]">
                          Email to {h.to}: delivery not confirmed
                        </span>
                      ) : h.kind === "failed" ? (
                        <span className="min-w-0 font-medium text-red-700 [overflow-wrap:anywhere]">
                          Email to {h.to} failed, no follow-up recorded
                        </span>
                      ) : (
                        <span className="text-stone-600">
                          Draft: {MESSAGE_TYPE_LABELS[h.type]}, {TONE_LABELS[h.tone].toLowerCase()} tone
                        </span>
                      )}
                      <span className="num shrink-0 text-stone-500">{formatDate(h.at)}</span>
                    </div>
                    {h.kind !== "failed" && (
                      <>
                        <p className={cn("mt-1 line-clamp-4 whitespace-pre-wrap text-[14px]", h.kind === "draft" ? "text-stone-500" : "text-stone-800")}>
                          {h.text}
                        </p>
                        {/* The entry above is cut to four lines, so a failed copy shows all of it. */}
                        <CopyButton text={h.text} label="Copy" showTextOnFail className="btn-ghost tap -ml-2 mt-0.5 px-2 py-0.5 text-[13px]" />
                      </>
                    )}
                  </li>
                ))}
                {history.length > 3 && (
                  <li>
                    <button
                      className="tap inline-flex items-center text-[14px] font-medium text-info-700 hover:underline"
                      onClick={() => setShowAll((s) => !s)}
                    >
                      {showAll ? "Show less" : `Show all ${history.length}`}
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
        )}
      </div>
      {confirmDialog}
    </Modal>
  );

  /** Kind, tone and anything to mention: they only shape AI drafts. */
  function aiOptions() {
    return (
      <div className="ql-in mt-3 grid gap-3 rounded-[12px] bg-canvas p-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ai-type">
            Kind of follow-up
          </label>
          <select id="ai-type" className="input" value={messageType} onChange={(e) => chooseType(e.target.value as MessageType)}>
            {MESSAGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {MESSAGE_TYPE_LABELS[t]}
                {t === suggested ? " (suggested)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ai-tone">
            Tone
          </label>
          <select id="ai-tone" className="input" value={tone} onChange={(e) => setTone(e.target.value as Tone)}>
            {TONES.map((t) => (
              <option key={t} value={t}>
                {TONE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="ai-context">
            {messageType === "objection_response" ? "What did the customer say?" : "Anything to mention? (optional)"}
          </label>
          <input
            id="ai-context"
            className="input"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="They said the price is higher than expected"
          />
        </div>
      </div>
    );
  }
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

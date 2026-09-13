"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  Check,
  Loader2,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { CopyButton } from "@/components/ui/CopyButton";
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
import type { Message } from "@/lib/types";
import { cn, formatCurrency, formatDate, relativeDay } from "@/lib/utils";
import { suggestMessageType } from "@/lib/follow-up-state";
import { logFollowUpSent } from "@/app/(app)/quotes/actions";

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
  | { kind: "logged"; id: string; at: string; text: string; number: number }
  | { kind: "draft"; id: string; at: string; text: string; type: MessageType; tone: Tone };

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Message[]>([]);
  const [logged, setLogged] = useState<LoggedEntry[]>([]);
  const [logging, startLog] = useTransition();
  const [logResult, setLogResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [showAll, setShowAll] = useState(false);

  const firstName = quote.customerName.split(" ")[0] || quote.customerName;
  const edited = content.trim() !== "" && content.trim() !== draft.trim();

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/generate-message?quoteId=${encodeURIComponent(quote.id)}`);
      if (!res.ok) return;
      const data = await res.json();
      setDrafts(data.messages ?? []);
      setLogged(data.logged ?? []);
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't write a message. Please try again.");
      setContent(data.content);
      setDraft(data.content);
      if (data.fellBack) {
        setNotice(
          `The AI provider couldn't be reached${data.error ? ` (${data.error})` : ""}, so this is a template you can edit.`
        );
      } else if (data.provider === "template") {
        setNotice("No AI key is configured, so this is a template you can edit.");
      }
      if (data.historySaved === false) {
        setError("The message was written but couldn't be saved to history.");
      }
      loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function markFollowedUp() {
    setLogResult(null);
    startLog(async () => {
      // Logs the text as it is now — including any edits — not the AI draft.
      const result = await logFollowUpSent(quote.id, content || null);
      if (result.logged) {
        const next = result.nextFollowUpAt
          ? `Next reminder ${relativeDay(result.nextFollowUpAt, today)}.`
          : "No more reminders are scheduled for this quote.";
        setLogResult({ ok: true, text: `Logged as follow-up #${result.followUpNumber}. ${next}` });
        loadHistory();
      } else {
        setLogResult({ ok: false, text: result.message ?? "Nothing was logged." });
      }
    });
  }

  const history: HistoryEntry[] = [
    ...logged.map((l) => ({
      kind: "logged" as const,
      id: `l-${l.id}`,
      at: l.completed_at ?? "",
      text: l.message_snapshot,
      number: l.follow_up_number,
    })),
    ...drafts.map((m) => ({
      kind: "draft" as const,
      id: `d-${m.id}`,
      at: m.created_at,
      text: m.content,
      type: m.message_type,
      tone: m.tone,
    })),
  ].sort((a, b) => Date.parse(b.at || "0") - Date.parse(a.at || "0"));
  const visibleHistory = showAll ? history : history.slice(0, 3);

  return (
    <Modal
      open
      onClose={onClose}
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
              className="btn-ghost px-2 py-1 text-xs"
              onClick={() => setAdjusting((a) => !a)}
              aria-expanded={adjusting}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {adjusting ? "Done" : "Adjust"}
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
              Written from this quote&apos;s details. You review it; nothing is sent automatically.
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
              Review before sending. QuotePilot never sends messages. Copy it into your own email or phone.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton text={content} label="Copy message" />
              <button
                className="btn-secondary"
                onClick={markFollowedUp}
                disabled={logging || Boolean(logResult?.ok)}
              >
                {logging ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : logResult?.ok ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : null}
                {logResult?.ok ? "Followed up" : "Mark as followed up"}
              </button>
              <button className="btn-ghost ml-auto" onClick={generate}>
                <RotateCcw className="h-4 w-4" /> Rewrite
              </button>
            </div>
            {logResult && (
              <div
                className={cn(
                  "rounded-md px-3 py-2 text-sm",
                  logResult.ok
                    ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200"
                    : "bg-stone-100 text-stone-700"
                )}
              >
                {logResult.text}
                {logResult.ok && edited && " Your edited text was saved as the message used."}
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

        {/* History: logged follow-ups (final text used) vs generated drafts */}
        <div className="border-t border-stone-200 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="eyebrow">History</span>
            {history.length > 3 && (
              <button className="text-xs font-medium text-stone-500 hover:text-stone-900" onClick={() => setShowAll((s) => !s)}>
                {showAll ? "Show less" : `Show all ${history.length}`}
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-stone-500">
              Messages you draft will appear here for reference. When you mark one as
              followed up, the exact text you used is kept.
            </p>
          ) : (
            <ul className="space-y-3">
              {visibleHistory.map((h) => (
                <li
                  key={h.id}
                  className={cn(
                    "border-l-2 pl-3",
                    h.kind === "logged" ? "border-emerald-500" : "border-stone-200"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    {h.kind === "logged" ? (
                      <span className="font-semibold text-emerald-800">
                        Logged follow-up #{h.number} · final text used
                      </span>
                    ) : (
                      <span className="font-medium text-stone-500">
                        Generated draft · {MESSAGE_TYPE_LABELS[h.type]} · {TONE_LABELS[h.tone]}
                      </span>
                    )}
                    <span className="shrink-0 text-stone-400">{formatDate(h.at)}</span>
                  </div>
                  <p
                    className={cn(
                      "mt-1 line-clamp-4 whitespace-pre-wrap text-sm",
                      h.kind === "logged" ? "text-stone-800" : "text-stone-500"
                    )}
                  >
                    {h.text}
                  </p>
                  <CopyButton text={h.text} label="Copy" className="btn-ghost -ml-2 mt-0.5 px-2 py-0.5 text-xs" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

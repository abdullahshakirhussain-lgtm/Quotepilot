"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { AlertTriangle, Check, Loader2, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { CopyButton } from "@/components/ui/CopyButton";
import {
  MESSAGE_TYPES,
  MESSAGE_TYPE_LABELS,
  TONES,
  TONE_LABELS,
  type MessageType,
  type Tone,
} from "@/lib/constants";
import type { Message } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { logFollowUpSent } from "@/app/(app)/quotes/actions";

export interface AIQuoteContext {
  id: string;
  title: string;
  customerName: string;
}

export function AIMessageModal({
  quote,
  onClose,
}: {
  quote: AIQuoteContext;
  onClose: () => void;
}) {
  const [messageType, setMessageType] = useState<MessageType>("first_follow_up");
  const [tone, setTone] = useState<Tone>("friendly");
  const [objection, setObjection] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<Message[]>([]);
  const [logging, startLog] = useTransition();
  const [logged, setLogged] = useState(false);
  const [logNote, setLogNote] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/generate-message?quoteId=${quote.id}`);
      const data = await res.json();
      if (res.ok) setHistory(data.messages ?? []);
    } catch {
      /* ignore history load errors */
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
        body: JSON.stringify({ quoteId: quote.id, messageType, tone, objection }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate message.");
      setContent(data.content);
      if (data.fellBack) {
        setNotice(
          `The AI provider couldn't be reached${data.error ? ` (${data.error})` : ""}, so here's a template you can edit instead.`
        );
      } else if (data.provider === "template") {
        setNotice(
          "No AI key configured — showing a smart template. Add an API key to enable AI generation."
        );
      }
      if (data.historySaved === false) {
        setError("The message was generated but couldn't be saved to history.");
      }
      loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function markSent() {
    setLogNote(null);
    startLog(async () => {
      // Store the final (possibly edited) text on the completed reminder.
      const result = await logFollowUpSent(quote.id, content || null);
      if (result.logged) setLogged(true);
      else setLogNote(result.message ?? "Nothing was logged.");
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="AI follow-up message"
      description={`For "${quote.title}" — ${quote.customerName}`}
    >
      <div className="space-y-5">
        {/* Controls */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Message type</label>
            <select
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
            <label className="label">Tone</label>
            <select
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
        </div>

        <div>
          <label className="label">
            {messageType === "objection_response"
              ? "Customer's objection *"
              : "Extra context / objection (optional)"}
          </label>
          <input
            className="input"
            value={objection}
            onChange={(e) => setObjection(e.target.value)}
            placeholder="e.g. Says the price is higher than expected"
          />
        </div>

        <button className="btn-primary" onClick={generate} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {content ? "Regenerate" : "Generate message"}
        </button>

        {notice && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Editable result */}
        {content && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              Review and edit before sending. QuotePilot never sends messages for
              you.
            </div>
            <textarea
              className="input min-h-[180px] font-normal"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-3">
              <CopyButton text={content} label="Copy message" />
              <button
                className="btn-secondary"
                onClick={markSent}
                disabled={logging || logged}
              >
                {logging ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : logged ? (
                  <Check className="h-4 w-4" />
                ) : null}
                {logged ? "Follow-up logged" : "Mark follow-up sent"}
              </button>
              <span className="text-xs text-slate-400">
                Marking as sent completes the next reminder for this quote.
              </span>
            </div>
            {logNote && (
              <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
                {logNote}
              </div>
            )}
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="border-t border-slate-200 pt-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">
              Message history ({history.length})
            </h3>
            <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
              {history.map((m) => (
                <div key={m.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-600">
                      {MESSAGE_TYPE_LABELS[m.message_type]} · {TONE_LABELS[m.tone]}
                    </span>
                    <span>{formatDate(m.created_at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">
                    {m.content}
                  </p>
                  <div className="mt-2">
                    <CopyButton
                      text={m.content}
                      label="Copy"
                      className="btn-ghost px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

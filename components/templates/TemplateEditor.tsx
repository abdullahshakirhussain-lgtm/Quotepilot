"use client";

import { useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";
import {
  fillSubject,
  fillTemplate,
  previewValues,
  starterFor,
  TEMPLATE_KIND_LABELS,
  TEMPLATE_KINDS,
  TEMPLATE_LIMITS,
  TEMPLATE_TOKENS,
  type MessageTemplate,
  type ResolvedTemplate,
  type TemplateKind,
} from "@/lib/templates";
import { saveTemplate } from "@/app/(app)/settings/template-actions";

export interface TemplateBusiness {
  name: string;
  ownerName: string | null;
  signOff: string | null;
  signature: string | null;
}

/**
 * Change the wording of a ready-made template, or write one of your own.
 * Tapping a word like [First name] puts it where the cursor is (in the subject
 * or the message, whichever was used last), and the preview shows the result
 * with real sample details.
 */
export function TemplateEditor({
  template,
  business,
  today,
  onSaved,
  onClose,
}: {
  /** Null for a new template of the user's own. */
  template: ResolvedTemplate | null;
  business: TemplateBusiness;
  today: string;
  onSaved: (row: MessageTemplate) => void;
  onClose: () => void;
}) {
  const readyMade = Boolean(template?.builtinKey);
  const startKind: TemplateKind = template?.kind ?? "quote_email";
  const [kind, setKind] = useState<TemplateKind>(startKind);
  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(template ? (template.subject ?? "") : starterFor(startKind).subject);
  const [body, setBody] = useState(template?.body ?? starterFor(startKind).body);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  const [lastField, setLastField] = useState<"subject" | "body">("body");
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const initial = useRef({ kind: startKind, name, subject, body });
  const dirty =
    kind !== initial.current.kind ||
    name !== initial.current.name ||
    subject !== initial.current.subject ||
    body !== initial.current.body;
  // A new template whose text wasn't touched follows the kind it's for.
  const untouched = !template && subject === starterFor(kind).subject && body === starterFor(kind).body;

  const values = previewValues(business, today);
  const previewSubject = fillSubject(subject, values);
  const previewBody = fillTemplate(body, values);

  function chooseKind(next: TemplateKind) {
    if (untouched) {
      setSubject(starterFor(next).subject);
      setBody(starterFor(next).body);
    }
    setKind(next);
  }

  function insert(token: string) {
    const isSubject = lastField === "subject";
    const el = isSubject ? subjectRef.current : bodyRef.current;
    const current = isSubject ? subject : body;
    const from = el?.selectionStart ?? current.length;
    const to = el?.selectionEnd ?? current.length;
    const next = current.slice(0, from) + token + current.slice(to);
    if (isSubject) setSubject(next.slice(0, TEMPLATE_LIMITS.subject));
    else setBody(next);
    // Put the cursor just after the inserted word.
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(from + token.length, from + token.length);
    });
  }

  function save() {
    if (busy) return;
    setError(null);
    start(async () => {
      try {
        const outcome = await saveTemplate({
          id: template?.rowId ?? null,
          builtinKey: template?.builtinKey ?? null,
          kind,
          name,
          subject,
          body,
        });
        if (!outcome.ok) return setError(outcome.error);
        onSaved(outcome.template);
      } catch (e) {
        unstable_rethrow(e); // a redirect Next is handling itself must not be swallowed
        setError("QuoteLoop couldn't be reached, so the template may not have been saved. Check your connection and try again.");
      }
    });
  }

  async function requestClose() {
    if (busy) return;
    if (
      dirty &&
      !(await confirm({
        title: "Close without saving?",
        message: "Your changes to this template won't be kept.",
        confirmLabel: "Discard changes",
        cancelLabel: "Keep editing",
        danger: true,
      }))
    )
      return;
    onClose();
  }

  return (
    <Modal
      open
      onClose={requestClose}
      size="lg"
      title={readyMade ? template!.name : template ? "Edit template" : "New template"}
      description={readyMade ? `${TEMPLATE_KIND_LABELS[kind]}. Your wording replaces QuoteLoop's; you can restore the original any time.` : undefined}
    >
      <div className="flex flex-col gap-4">
        {!readyMade && (
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <label className="label" htmlFor="template-name">
                Name
              </label>
              <input
                id="template-name"
                className="input"
                value={name}
                maxLength={TEMPLATE_LIMITS.name}
                placeholder="e.g. Friendly check-in"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div role="group" aria-label="Used for" className="inline-flex justify-self-start rounded-full bg-stone-100 p-1 text-[14px] font-medium sm:self-end">
              {TEMPLATE_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => chooseKind(k)}
                  aria-pressed={kind === k}
                  className={cn(
                    "tap rounded-full px-3.5 py-1 transition-colors duration-150",
                    kind === k ? "bg-stone-900 text-white" : "text-stone-600 hover:text-stone-900"
                  )}
                >
                  {TEMPLATE_KIND_LABELS[k]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="label" htmlFor="template-subject">
            Subject <span className="font-normal text-stone-500">(optional)</span>
          </label>
          <input
            ref={subjectRef}
            id="template-subject"
            className="input"
            value={subject}
            maxLength={TEMPLATE_LIMITS.subject}
            onFocus={() => setLastField("subject")}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="template-body">
            Message
          </label>
          <div className="mb-2 flex flex-wrap gap-1.5" aria-label="Insert a detail">
            {TEMPLATE_TOKENS.map((t) => (
              <button
                key={t.token}
                type="button"
                title={t.hint}
                // Keeps the cursor where it was in the field.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insert(t.token)}
                className="tap inline-flex items-center rounded-full border border-line bg-white px-2.5 text-[13px] font-medium text-stone-700 hover:border-stone-400 hover:text-stone-900"
              >
                {t.token}
              </button>
            ))}
          </div>
          <textarea
            ref={bodyRef}
            id="template-body"
            className="input min-h-[200px] resize-y leading-relaxed"
            value={body}
            maxLength={TEMPLATE_LIMITS.body}
            onFocus={() => setLastField("body")}
            onChange={(e) => setBody(e.target.value)}
          />
          <p className="mt-1 hint">
            Words in brackets are filled in from each quote. A line with [Details] or [Valid until] is left out when
            the quote has none.
          </p>
        </div>

        <section aria-label="Preview" className="rounded-[12px] border border-line bg-canvas p-4">
          <h3 className="text-[13px] font-medium text-stone-500">Preview with sample details</h3>
          {previewSubject && <p className="mt-2 text-[15px] font-semibold text-stone-900 [overflow-wrap:anywhere]">{previewSubject}</p>}
          <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-stone-800 [overflow-wrap:anywhere]">
            {previewBody || <span className="text-stone-500">Your message shows here.</span>}
          </p>
        </section>

        {error && (
          <div role="alert" className="msg-error">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <button type="button" className="btn-ghost" onClick={requestClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={save}
            disabled={busy || (!readyMade && !name.trim()) || !body.trim()}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {readyMade ? "Save wording" : "Save template"}
          </button>
        </div>
      </div>
      {confirmDialog}
    </Modal>
  );
}

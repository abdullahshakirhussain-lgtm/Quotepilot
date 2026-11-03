"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { SettingsSection } from "@/components/ui/SettingsSection";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useCanWrite } from "@/components/billing/AccessContext";
import {
  defaultQuoteTemplateId,
  resolveTemplates,
  signatureParts,
  TEMPLATE_LIMITS,
  type MessageTemplate,
  type ResolvedTemplate,
  type TemplateKind,
} from "@/lib/templates";
import { deleteTemplate, saveSignOff, setQuoteTemplate } from "@/app/(app)/settings/template-actions";
import { TemplateEditor, type TemplateBusiness } from "./TemplateEditor";

type Message = { tone: "success" | "error"; text: string } | null;
const unreachable = "QuoteLoop couldn't be reached, so that may not have been saved. Refresh the page to check.";

/**
 * Settings → Sign-off, and Message templates: QuoteLoop's ready-made wording
 * (each can be edited and restored), the user's own templates, and which
 * quote email new quotes start from.
 */
export function TemplatesSection({
  initialRows,
  business,
  quoteTemplate,
  today,
}: {
  initialRows: MessageTemplate[];
  business: TemplateBusiness;
  /** businesses.quote_template */
  quoteTemplate: string | null;
  today: string;
}) {
  const [rows, setRows] = useState(initialRows);
  const [choice, setChoice] = useState(quoteTemplate);
  const [signOff, setSignOff] = useState(business.signOff ?? "");
  const [signature, setSignature] = useState(business.signature ?? "");
  const [savedSign, setSavedSign] = useState({ signOff: business.signOff, signature: business.signature });
  // undefined: closed. null: a new template of the user's own.
  const [editing, setEditing] = useState<ResolvedTemplate | null | undefined>(undefined);
  const [message, setMessage] = useState<Message>(null);
  const [signMessage, setSignMessage] = useState<Message>(null);
  const [busy, start] = useTransition();
  const [signBusy, startSign] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  const canWrite = useCanWrite();

  const templates = resolveTemplates(rows);
  const defaultQuote = defaultQuoteTemplateId(choice, templates);
  const ownCount = rows.filter((r) => !r.builtin_key).length;
  const full = ownCount >= TEMPLATE_LIMITS.perAccount;
  const withSign = { ...business, signOff: savedSign.signOff, signature: savedSign.signature };
  const ending = signatureParts({ ownerName: business.ownerName, businessName: business.name, signOff, signature });

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, done: () => void, success: string) {
    setMessage(null);
    start(async () => {
      try {
        const outcome = await action();
        if (!outcome.ok) return setMessage({ tone: "error", text: outcome.error });
        done();
        setMessage({ tone: "success", text: success });
      } catch (e) {
        unstable_rethrow(e); // a redirect Next is handling itself must not be swallowed
        setMessage({ tone: "error", text: unreachable });
      }
    });
  }

  function saved(row: MessageTemplate) {
    setRows((list) => {
      const at = list.findIndex((x) => x.id === row.id);
      if (at === -1) return [...list, row];
      const next = [...list];
      next[at] = row;
      return next;
    });
    setEditing(undefined);
    setMessage({ tone: "success", text: `"${row.name}" saved.` });
  }

  async function restore(t: ResolvedTemplate) {
    const ok = await confirm({
      title: `Restore QuoteLoop's wording for "${t.name}"?`,
      message: "Your changes to this template are removed. Messages already sent keep their text.",
      confirmLabel: "Restore original",
      cancelLabel: "Keep my wording",
    });
    if (!ok || !t.rowId) return;
    const rowId = t.rowId;
    run(() => deleteTemplate(rowId), () => setRows((list) => list.filter((x) => x.id !== rowId)), `"${t.name}" is back to QuoteLoop's wording.`);
  }

  async function remove(t: ResolvedTemplate) {
    const ok = await confirm({
      title: `Delete "${t.name}"?`,
      message:
        t.id === defaultQuote
          ? "New quotes will use the Standard quote email instead. Messages already sent keep their text."
          : "Messages already sent keep their text. The template itself can't be brought back.",
      confirmLabel: "Delete template",
      cancelLabel: "Keep template",
      danger: true,
    });
    if (!ok || !t.rowId) return;
    const rowId = t.rowId;
    run(() => deleteTemplate(rowId), () => setRows((list) => list.filter((x) => x.id !== rowId)), `"${t.name}" deleted.`);
  }

  function makeQuoteDefault(t: ResolvedTemplate) {
    run(() => setQuoteTemplate(t.id), () => setChoice(t.id), `New quotes now start from "${t.name}".`);
  }

  function saveSign() {
    if (signBusy) return;
    setSignMessage(null);
    startSign(async () => {
      try {
        const outcome = await saveSignOff({ signOff, signature });
        if (!outcome.ok) return setSignMessage({ tone: "error", text: outcome.error });
        setSavedSign({ signOff: signOff.trim() || null, signature: signature.trim() || null });
        setSignMessage({ tone: "success", text: "Sign-off saved." });
      } catch (e) {
        unstable_rethrow(e); // a redirect Next is handling itself must not be swallowed
        setSignMessage({ tone: "error", text: unreachable });
      }
    });
  }

  const group = (kind: TemplateKind, heading: string) => (
    <div>
      <h3 className="mb-2 text-[14px] font-medium text-stone-500">{heading}</h3>
      <ul className="divide-y divide-line rounded-[12px] border border-line">
        {templates
          .filter((t) => t.kind === kind)
          .map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                <button
                  type="button"
                  className="tap inline-flex items-center text-left text-[15px] font-medium text-stone-900 hover:underline disabled:no-underline [overflow-wrap:anywhere]"
                  onClick={() => setEditing(t)}
                  disabled={!canWrite}
                >
                  {t.name}
                </button>
                {t.edited && <span className="chip-muted">Edited</span>}
                {!t.builtinKey && <span className="chip-muted">Your own</span>}
                {kind === "quote_email" && t.id === defaultQuote && <span className="chip-soon">Used for new quotes</span>}
              </div>
              {canWrite && (
                <Menu label={`Actions for ${t.name}`}>
                  <MenuItem onClick={() => setEditing(t)}>Edit wording</MenuItem>
                  {kind === "quote_email" && t.id !== defaultQuote && (
                    <MenuItem disabled={busy} onClick={() => makeQuoteDefault(t)}>
                      Use for new quotes
                    </MenuItem>
                  )}
                  {t.edited && (
                    <MenuItem disabled={busy} onClick={() => restore(t)}>
                      Restore original
                    </MenuItem>
                  )}
                  {!t.builtinKey && (
                    <MenuItem danger disabled={busy} onClick={() => remove(t)}>
                      Delete
                    </MenuItem>
                  )}
                </Menu>
              )}
            </li>
          ))}
      </ul>
    </div>
  );

  return (
    <>
      <SettingsSection
        id="sign-off"
        title="Sign-off"
        description="Ends every template and AI draft. Leave it empty to use your name and business name."
      >
        <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <div>
            <label className="label" htmlFor="template-sign-off">
              Sign-off
            </label>
            <input
              id="template-sign-off"
              className="input"
              value={signOff}
              maxLength={TEMPLATE_LIMITS.signOff}
              placeholder="Thanks,"
              onChange={(e) => setSignOff(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="template-signature">
              Signature
            </label>
            <textarea
              id="template-signature"
              className="input min-h-[88px] resize-y leading-relaxed"
              rows={3}
              value={signature}
              maxLength={TEMPLATE_LIMITS.signature}
              placeholder={signatureParts({ ownerName: business.ownerName, businessName: business.name }).signature || "Your name, business name"}
              onChange={(e) => setSignature(e.target.value)}
            />
            <p className="mt-1 hint">Up to 5 lines, like your name, phone number and website.</p>
          </div>
        </div>
        <p className="mt-3 text-[14px] text-stone-500">Your messages end like this:</p>
        <p className="mt-1 whitespace-pre-wrap text-[15px] text-stone-800 [overflow-wrap:anywhere]">
          {ending.signOff}
          {"\n"}
          {ending.signature}
        </p>
        <button type="button" className="btn-secondary mt-4" onClick={saveSign} disabled={!canWrite || signBusy}>
          {signBusy && <Loader2 className="h-4 w-4 animate-spin" />} Save sign-off
        </button>
        {signMessage && (
          <div role="status" className={`mt-4 ${signMessage.tone === "success" ? "msg-success" : "msg-error"}`}>
            {signMessage.text}
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        id="templates"
        title="Message templates"
        description="Ready-made wording for each quote email and reminder. Use them as they are, or change the wording to sound like you."
      >
        <div className="flex flex-col gap-5">
          {group("quote_email", "Quote emails")}
          {group("follow_up", "Follow-ups")}
        </div>

        <button type="button" className="btn-secondary mt-4" onClick={() => setEditing(null)} disabled={!canWrite || full}>
          <Plus className="h-4 w-4" /> New template
        </button>
        {full && (
          <p className="mt-2 hint">
            You have {TEMPLATE_LIMITS.perAccount} of your own templates, the most an account can keep. Delete one to add another.
          </p>
        )}

        {message && (
          <div role="status" className={`mt-4 ${message.tone === "success" ? "msg-success" : "msg-error"}`}>
            {message.text}
          </div>
        )}

        {editing !== undefined && (
          <TemplateEditor
            template={editing}
            business={withSign}
            today={today}
            onSaved={saved}
            onClose={() => setEditing(undefined)}
          />
        )}
        {confirmDialog}
      </SettingsSection>
    </>
  );
}

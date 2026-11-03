"use client";

import { useEffect, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Database, Loader2, Trash2 } from "lucide-react";
import { clearAllData, removeSampleData, seedDemoData } from "@/app/(app)/settings/actions";
import type { ActionState } from "@/app/(app)/settings/actions";
import { Modal } from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { SettingsSection } from "@/components/ui/SettingsSection";
import { reloadWithMessage, takeFlash } from "@/lib/flash";

/** Typed to confirm "Delete all data", so a stray Enter can never wipe a workspace. */
const CONFIRM_WORD = "DELETE";

type Part = "sample" | "clear";

/**
 * Runs a settings action; a request that never got an answer is said so, not a
 * crash. Done: the page reloads to show the new state everywhere, with the
 * confirmation shown again after it, in the section that asked.
 */
async function attempt(part: Part, action: () => Promise<ActionState>, unreachable: string): Promise<ActionState> {
  let result: ActionState;
  try {
    result = await action();
  } catch (e) {
    unstable_rethrow(e); // a redirect Next is handling itself must not be swallowed
    return { error: unreachable };
  }
  if (result.ok) reloadWithMessage(`data-${part}`, result.message ?? "Done.");
  return result;
}

/**
 * Settings → Sample data, and well apart from it, Delete all data: the one
 * place a whole workspace can be wiped, in its own red section at the end.
 */
export function DataControls() {
  const [seeding, startSeed] = useTransition();
  const [clearing, startClear] = useTransition();
  const [removing, startRemove] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  // Each message shows in the section whose button produced it.
  const [result, setResult] = useState<(ActionState & { part: Part }) | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const confirmed = typed.trim().toUpperCase() === CONFIRM_WORD;
  const busy = seeding || clearing || removing;

  // The confirmation from just before the reload.
  useEffect(() => {
    for (const part of ["sample", "clear"] as const) {
      const message = takeFlash(`data-${part}`);
      if (message) setResult({ ok: true, message, part });
    }
  }, []);

  function clearEverything() {
    if (!confirmed) return;
    setConfirming(false);
    setTyped("");
    setResult(null);
    startClear(async () => {
      const r = await attempt(
        "clear",
        clearAllData,
        "QuoteLoop couldn't be reached, so your data may not have been deleted, or only partly. Refresh the page to check, then try again."
      );
      setResult({ ...r, part: "clear" });
    });
  }

  const message = (part: Part) => {
    if (result?.part !== part) return null;
    if (result.error)
      return (
        <div role="alert" className="msg-error mt-3">
          {result.error}
        </div>
      );
    if (result.ok && result.message)
      return (
        <div role="status" className="msg-success mt-3">
          {result.message}
        </div>
      );
    return null;
  };

  return (
    <>
      <SettingsSection
        title="Sample data"
        description="Load made-up sample quotes into an empty workspace to explore. Remove them again without touching your own records."
      >
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => {
              setResult(null);
              startSeed(async () => {
                const r = await attempt(
                  "sample",
                  seedDemoData,
                  "QuoteLoop couldn't be reached, so the sample data may not have loaded. Refresh the page to check, then try again."
                );
                setResult({ ...r, part: "sample" });
              });
            }}
          >
            {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            Load sample data
          </button>

          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={async () => {
              if (
                !(await confirm({
                  title: "Remove sample data?",
                  message: "The sample customers and their quotes are removed. Anything you added yourself stays.",
                  confirmLabel: "Remove sample data",
                  cancelLabel: "Keep sample data",
                  danger: true,
                }))
              )
                return;
              setResult(null);
              startRemove(async () => {
                const r = await attempt(
                  "sample",
                  removeSampleData,
                  "QuoteLoop couldn't be reached, so the sample data may not have been removed. Refresh the page to check, then try again."
                );
                setResult({ ...r, part: "sample" });
              });
            }}
          >
            {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Remove sample data
          </button>
        </div>
        {message("sample")}
      </SettingsSection>

      <SettingsSection
        title="Delete all data"
        danger
        description="Start fresh: every customer, quote, follow-up and message is deleted. Your business profile is kept."
      >
        <button
          type="button"
          className="btn-danger"
          disabled={busy}
          onClick={() => {
            setTyped("");
            setConfirming(true);
          }}
        >
          {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Delete all data
        </button>
        <p className="hint mt-2">You&apos;re asked to type {CONFIRM_WORD} first. This can&apos;t be undone.</p>
        {message("clear")}
      </SettingsSection>

      {confirming && (
        <Modal open onClose={() => setConfirming(false)} title="Delete all data?" description="This can't be undone.">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              clearEverything();
            }}
            className="flex flex-col gap-4"
          >
            <p className="text-[15px] text-stone-700">
              Every customer, quote, follow-up and message in this workspace is deleted. Your business
              profile stays, and records of emails QuoteLoop already sent are kept as your sending history.
            </p>
            <div>
              <label htmlFor="confirm-delete" className="label">
                Type {CONFIRM_WORD} to confirm
              </label>
              <input
                id="confirm-delete"
                className="input"
                autoComplete="off"
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>
                Keep my data
              </button>
              <button type="submit" className="btn-danger" disabled={!confirmed}>
                <Trash2 className="h-4 w-4" /> Delete everything
              </button>
            </div>
          </form>
        </Modal>
      )}
      {confirmDialog}
    </>
  );
}

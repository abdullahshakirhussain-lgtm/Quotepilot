"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Database, Loader2, Trash2 } from "lucide-react";
import { clearAllData, removeSampleData, seedDemoData } from "@/app/(app)/settings/actions";
import type { ActionState } from "@/app/(app)/settings/actions";
import { Modal } from "@/components/ui/Modal";

/** Typed to confirm "Delete all data", so a stray Enter can never wipe a workspace. */
const CONFIRM_WORD = "DELETE";

/** Runs a settings action; a request that never got an answer is said so, not a crash. */
async function attempt(action: () => Promise<ActionState>, unreachable: string): Promise<ActionState> {
  try {
    return await action();
  } catch (e) {
    unstable_rethrow(e); // a redirect Next is handling itself must not be swallowed
    return { error: unreachable };
  }
}

export function DataControls() {
  const [seeding, startSeed] = useTransition();
  const [clearing, startClear] = useTransition();
  const [removing, startRemove] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const confirmed = typed.trim().toUpperCase() === CONFIRM_WORD;

  function clearEverything() {
    if (!confirmed) return;
    setConfirming(false);
    setTyped("");
    setResult(null);
    startClear(async () =>
      setResult(
        await attempt(
          clearAllData,
          "QuoteLoop couldn't be reached, so your data may not have been deleted, or only partly. Refresh the page to check, then try again."
        )
      )
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="btn-secondary"
          disabled={seeding || clearing || removing}
          onClick={() => {
            setResult(null);
            startSeed(async () =>
              setResult(
                await attempt(
                  seedDemoData,
                  "QuoteLoop couldn't be reached, so the sample data may not have loaded. Refresh the page to check, then try again."
                )
              )
            );
          }}
        >
          {seeding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Database className="h-4 w-4" />
          )}
          Load sample data
        </button>

        <button
          type="button"
          className="btn-secondary"
          disabled={seeding || clearing || removing}
          onClick={() => {
            if (!window.confirm("Remove the sample customers and their quotes? Anything you added yourself stays.")) return;
            setResult(null);
            startRemove(async () =>
              setResult(
                await attempt(
                  removeSampleData,
                  "QuoteLoop couldn't be reached, so the sample data may not have been removed. Refresh the page to check, then try again."
                )
              )
            );
          }}
        >
          {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Remove sample data
        </button>

        <button
          type="button"
          className="btn-danger"
          disabled={seeding || clearing || removing}
          onClick={() => {
            setTyped("");
            setConfirming(true);
          }}
        >
          {clearing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Delete all data
        </button>
      </div>

      {confirming && (
        <Modal
          open
          onClose={() => setConfirming(false)}
          title="Delete all data?"
          description="This can't be undone."
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              clearEverything();
            }}
            className="flex flex-col gap-4"
          >
            <p className="text-sm text-stone-600">
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
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-danger" disabled={!confirmed}>
                <Trash2 className="h-4 w-4" /> Delete everything
              </button>
            </div>
          </form>
        </Modal>
      )}

      {result?.error && (
        <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {result.error}
        </div>
      )}
      {result?.ok && result.message && (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {result.message}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Database, Loader2, Trash2 } from "lucide-react";
import { clearAllData, seedDemoData } from "@/app/(app)/settings/actions";
import type { ActionState } from "@/app/(app)/settings/actions";

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
  const [result, setResult] = useState<ActionState | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="btn-secondary"
          disabled={seeding || clearing}
          onClick={() => {
            setResult(null);
            startSeed(async () =>
              setResult(
                await attempt(
                  seedDemoData,
                  "QuoteLoop couldn't be reached, so the demo data may not have loaded. Refresh the page to check, then try again."
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
          Load demo data
        </button>

        <button
          type="button"
          className="btn-danger"
          disabled={seeding || clearing}
          onClick={() => {
            if (
              window.confirm(
                "Delete ALL of your customers, quotes, follow-ups and messages? This cannot be undone. " +
                  "Records of emails QuoteLoop already sent are kept as your sending history."
              )
            ) {
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

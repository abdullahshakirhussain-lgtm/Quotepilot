"use client";

import { useState, useTransition } from "react";
import { Database, Loader2, Trash2 } from "lucide-react";
import { clearAllData, seedDemoData } from "@/app/(app)/settings/actions";
import type { ActionState } from "@/app/(app)/settings/actions";

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
            startSeed(async () => setResult(await seedDemoData()));
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
              startClear(async () => setResult(await clearAllData()));
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
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
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

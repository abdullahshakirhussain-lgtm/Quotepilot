"use client";

import { useTransition } from "react";
import { Database, Loader2, Trash2 } from "lucide-react";
import { clearAllData, seedDemoData } from "@/app/(app)/settings/actions";

export function DataControls() {
  const [seeding, startSeed] = useTransition();
  const [clearing, startClear] = useTransition();

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        className="btn-secondary"
        disabled={seeding}
        onClick={() => startSeed(async () => await seedDemoData())}
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
        disabled={clearing}
        onClick={() => {
          if (
            window.confirm(
              "Delete ALL of your leads, quotes, follow-ups and messages? This cannot be undone."
            )
          ) {
            startClear(async () => await clearAllData());
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
  );
}

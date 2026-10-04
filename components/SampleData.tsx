"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { Database, Loader2, Trash2 } from "lucide-react";
import { removeSampleData, seedDemoData, type ActionState } from "@/app/(app)/settings/actions";

const UNREACHABLE = "QuoteLoop couldn't be reached. Check your connection, refresh the page and try again.";

async function attempt(action: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await action();
  } catch (e) {
    unstable_rethrow(e); // a redirect Next is handling itself must not be swallowed
    return { error: UNREACHABLE };
  }
}

/** Marks a made-up demo customer or quote. */
export function SampleBadge() {
  return (
    <span className="badge shrink-0 bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200" title="Made-up demo data. Nothing is ever emailed to it.">
      Sample
    </span>
  );
}

/**
 * Shown while demo data is in the workspace: says plainly that it's made up,
 * and removes it in one step without touching the user's own records.
 */
export function SampleDataBanner() {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mb-5 rounded-lg bg-violet-50 px-4 py-3 text-sm text-violet-900 ring-1 ring-inset ring-violet-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>
          <span className="font-semibold">You&apos;re looking at sample data.</span> These customers are made up,
          so nothing is ever emailed to them. Remove them when you&apos;re ready to add your own quotes.
        </p>
        <button
          type="button"
          className="btn-secondary shrink-0"
          disabled={busy}
          onClick={() => {
            if (!window.confirm("Remove the sample customers and their quotes? Anything you added yourself stays.")) return;
            setError(null);
            start(async () => {
              const result = await attempt(removeSampleData);
              if (result.error) return setError(result.error);
              router.refresh();
            });
          }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Remove sample data
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

/** Loads the demo data straight from the dashboard of an empty workspace. */
export function LoadSampleDataButton({ className = "btn-secondary" }: { className?: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={busy}
        onClick={() => {
          setError(null);
          start(async () => {
            const result = await attempt(seedDemoData);
            if (result.error) return setError(result.error);
            router.refresh();
          });
        }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
        {busy ? "Loading sample data…" : "Try it with sample data"}
      </button>
      {error && (
        <p role="alert" className="basis-full text-sm text-red-700">
          {error}
        </p>
      )}
    </>
  );
}

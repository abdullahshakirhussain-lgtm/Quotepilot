"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Database, Loader2, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
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
    <span className="shrink-0 text-[13px] font-medium text-stone-500" title="Made-up demo data. Nothing is ever emailed to it.">
      Sample
    </span>
  );
}

/**
 * Shown while demo data is in the workspace: says plainly that it's made up,
 * and removes it in one step without touching the user's own records.
 */
export function SampleDataBanner() {
  const [busy, start] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  const [error, setError] = useState<string | null>(null);

  return (
    <div data-sample-banner className="msg-info mb-4 text-[14px] text-stone-700">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p>
          <span className="font-medium text-stone-900">You&apos;re looking at sample data.</span>{" "}
          <span className="hidden sm:inline">
            These customers are made up, so nothing is ever emailed to them. Remove them when you&apos;re ready to add
            your own quotes.
          </span>
          <span className="sm:hidden">Nothing is emailed to these customers.</span>
        </p>
        <button
          type="button"
          className="tap inline-flex shrink-0 items-center gap-1.5 font-medium text-info-700 hover:underline disabled:opacity-50"
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
            setError(null);
            start(async () => {
              const result = await attempt(removeSampleData);
              if (result.error) return setError(result.error);
              // A one-off change to the whole workspace: reload the page. Waiting
              // for the action's streamed update sometimes left the button
              // spinning for good (the data had saved; the page never updated).
              window.location.reload();
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
      {confirmDialog}
    </div>
  );
}

/** Loads the demo data straight from the dashboard of an empty workspace. */
export function LoadSampleDataButton({ className = "btn-secondary" }: { className?: string }) {
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
            // Reload rather than wait for the streamed update (see above).
            window.location.reload();
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

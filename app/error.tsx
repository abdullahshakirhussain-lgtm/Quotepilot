"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

// Catches errors from nested layouts (e.g. the app shell failing to load the
// workspace), which the (app)/error.tsx boundary can't see.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="card max-w-md p-8 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-500">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold text-stone-900">
          Something went wrong
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          We couldn&apos;t load this page. Your data is safe — please try again.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-stone-400">Reference: {error.digest}</p>
        )}
        <button onClick={reset} className="btn-primary mx-auto mt-6">
          <RotateCcw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </main>
  );
}

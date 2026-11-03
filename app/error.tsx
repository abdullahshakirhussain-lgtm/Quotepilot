"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";

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
    <AuthShell>
      <div className="ql-in">
        <h1 className="page-title">Something went wrong</h1>
        <p className="mt-3 text-base text-stone-700">
          We couldn&apos;t load this page. Your data is safe. Try again.
        </p>
        {error.digest && <p className="num mt-2 text-[14px] text-stone-600">Reference: {error.digest}</p>}
        <button onClick={reset} className="btn-primary mt-6">
          <RotateCcw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </AuthShell>
  );
}

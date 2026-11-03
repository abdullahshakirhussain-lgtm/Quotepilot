"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

export default function AppError({
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
    <div className="card ql-in max-w-[30rem] p-6">
      <h1 className="page-title">Something went wrong</h1>
      <p className="mt-3 text-base text-stone-700">
        If you were saving a change, it may not have gone through. Check your connection, then try again.
      </p>
      <button onClick={reset} className="btn-primary mt-6">
        <RotateCcw className="h-4 w-4" />
        Try again
      </button>
    </div>
  );
}

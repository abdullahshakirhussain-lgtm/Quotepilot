"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { READ_ONLY_MESSAGE } from "@/lib/billing";

// Whether this account may create, send and draft (the server checks again).
// Published by <AccessFlag> in the app layout; read by the create/send windows,
// which only open after the page has loaded (until then it reads as allowed).
let current = true;
const listeners = new Set<() => void>();

export function AccessFlag({ canWrite }: { canWrite: boolean }) {
  useEffect(() => {
    current = canWrite;
    listeners.forEach((l) => l());
  }, [canWrite]);
  return null;
}

export function useCanWrite(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => current,
    () => true
  );
}

/** At the top of a form that would create, send or draft, when the account is read-only. */
export function ReadOnlyNotice() {
  if (useCanWrite()) return null;
  return (
    <div role="alert" className="mb-4 msg-error">
      {READ_ONLY_MESSAGE}{" "}
      <Link href="/settings#billing" className="font-medium underline underline-offset-2">
        Go to billing
      </Link>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/types";

/**
 * Renders a button that asks for confirmation, then runs a (usually server)
 * action. Used for destructive actions like delete. A failure is handed to
 * `onError` so the page can show it, instead of the whole-page error screen.
 */
export function ConfirmButton({
  action,
  confirmMessage,
  className,
  children,
  title,
  onError,
}: {
  action: () => Promise<ActionResult>;
  confirmMessage: string;
  className?: string;
  children: React.ReactNode;
  title?: string;
  onError?: (message: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={pending}
      className={className}
      onClick={() => {
        if (window.confirm(confirmMessage)) {
          onError?.(null);
          startTransition(async () => {
            try {
              const result = await action();
              if (!result.ok) onError?.(result.error);
            } catch (e) {
              unstable_rethrow(e); // a redirect Next is handling itself must not be swallowed
              onError?.(
                "That didn't go through, so nothing was deleted. You may have lost your connection, or been signed out in another tab — refresh the page and try again."
              );
            }
          });
        }
      }}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}

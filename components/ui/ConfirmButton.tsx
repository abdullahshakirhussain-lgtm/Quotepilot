"use client";

import { useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/types";
import { useConfirm, type ConfirmOptions } from "@/components/ui/ConfirmDialog";

/**
 * Renders a button that asks for confirmation, then runs a (usually server)
 * action. Used for destructive actions like delete. A failure is handed to
 * `onError` so the page can show it, instead of the whole-page error screen.
 */
export function ConfirmButton({
  action,
  confirm: options,
  className,
  children,
  title,
  onError,
}: {
  action: () => Promise<ActionResult>;
  /** The question asked first, in the app's own dialog. */
  confirm: ConfirmOptions;
  className?: string;
  children: React.ReactNode;
  title?: string;
  onError?: (message: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();

  return (
    <>
      <button
        type="button"
        title={title}
        aria-label={title}
        disabled={pending}
        className={className}
        onClick={async () => {
          if (!(await confirm(options))) return;
          onError?.(null);
          startTransition(async () => {
            try {
              const result = await action();
              if (!result.ok) onError?.(result.error);
            } catch (e) {
              unstable_rethrow(e); // a redirect Next is handling itself must not be swallowed
              onError?.(
                "That didn't go through, so nothing was deleted. You may have lost your connection, or been signed out in another tab. Refresh the page and try again."
              );
            }
          });
        }}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
      </button>
      {confirmDialog}
    </>
  );
}

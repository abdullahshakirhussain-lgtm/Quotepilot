"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";

/**
 * Renders a button that asks for confirmation, then runs a (usually server)
 * action. Used for destructive actions like delete.
 */
export function ConfirmButton({
  action,
  confirmMessage,
  className,
  children,
  title,
}: {
  action: () => Promise<void> | void;
  confirmMessage: string;
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      title={title}
      disabled={pending}
      className={className}
      onClick={() => {
        if (window.confirm(confirmMessage)) {
          startTransition(async () => {
            await action();
          });
        }
      }}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}

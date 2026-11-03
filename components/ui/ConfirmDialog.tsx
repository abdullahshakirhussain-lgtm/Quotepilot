"use client";

import { useCallback, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";

export interface ConfirmOptions {
  title: string;
  /** What happens, in plain words: the object and the consequence. */
  message: React.ReactNode;
  /** Names the outcome, e.g. "Delete quote". */
  confirmLabel: string;
  /** Names the other outcome, e.g. "Keep quote". */
  cancelLabel: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
}

/**
 * The app's own confirmation, instead of the browser's grey pop-up. Buttons
 * say what happens ("Delete quote" / "Keep quote"); focus starts on the
 * dialog's Close button, never the destructive one, and Escape or the
 * backdrop keep things as they are.
 *
 *   const [confirm, confirmDialog] = useConfirm();
 *   if (await confirm({ ... })) deleteIt();
 *   return <>{...}{confirmDialog}</>;
 */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, React.ReactNode] {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const finish = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  };

  const dialog = options ? (
    <Modal open title={options.title} onClose={() => finish(false)}>
      {/* data-confirm: lets the test harness answer it, as it did the browser pop-ups. */}
      <div data-confirm className="flex flex-col gap-5">
        <div className="text-base leading-relaxed text-stone-800">{options.message}</div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" data-confirm-cancel className="btn-secondary" onClick={() => finish(false)}>
            {options.cancelLabel}
          </button>
          <button
            type="button"
            data-confirm-ok
            className={options.danger ? "btn border-0 bg-red-600 text-white hover:bg-red-700" : "btn-primary"}
            onClick={() => finish(true)}
          >
            {options.confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  ) : null;

  return [confirm, dialog];
}

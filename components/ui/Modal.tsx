"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Open dialogs; the page stays locked from scrolling until the last one closes. */
let openCount = 0;

/** False on the server and while hydrating, true after: dialogs render into <body>. */
const noop = () => () => {};
function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}

/** Whether `el` is the top dialog when one opens another (e.g. a confirmation). */
function isTop(el: HTMLElement | null) {
  const dialogs = document.querySelectorAll('[role="dialog"]');
  return el !== null && dialogs[dialogs.length - 1] === el;
}

/** The controls a keyboard can reach inside the dialog, in order. */
function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** "panel": a full-height sheet sliding in from the right (the quote page). */
  size?: "md" | "lg" | "panel";
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const mounted = useMounted();
  const shown = open && mounted;

  useEffect(() => {
    if (!shown) return;
    openCount += 1;
    document.body.style.overflow = "hidden";
    return () => {
      openCount -= 1;
      if (openCount === 0) document.body.style.overflow = "";
    };
  }, [shown]);

  useEffect(() => {
    if (!shown) return;
    // Escape closes only the top dialog, never the one underneath too.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isTop(dialogRef.current)) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shown, onClose]);

  // Keyboard focus belongs to the open dialog: move it in, keep Tab inside,
  // and hand it back to whatever opened the dialog when it closes.
  useEffect(() => {
    if (!shown) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      // A field that focuses itself (autoFocus) keeps it; otherwise the first control.
      if (dialog && !dialog.contains(document.activeElement)) (focusables(dialog)[0] ?? dialog).focus();
    });
    const onTab = (e: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (e.key !== "Tab" || !dialog) return;
      // Only the top dialog traps focus when one opens another.
      if (!isTop(dialog)) return;
      const items = focusables(dialog);
      if (!items.length) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const inside = dialog.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onTab);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onTab);
      if (opener?.isConnected) opener.focus();
    };
  }, [shown]);

  if (!shown) return null;

  const panel = size === "panel";

  // Rendered into <body>, so a dialog opened from inside another (or from a
  // row with its own animation) is never clipped or positioned by its parent.
  return createPortal(
    <div
      className={
        panel
          ? "ql-fade fixed inset-0 z-50 flex justify-end bg-stone-950/40"
          : "ql-fade fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-stone-950/50 sm:items-start sm:p-8"
      }
      onMouseDown={(e) => {
        // Only a press on the dimmed backdrop itself closes the dialog — not
        // one on this layer's scrollbar, which a tall dialog scrolls with.
        const layer = e.currentTarget;
        if (e.target !== layer) return;
        if (e.clientX >= layer.clientWidth || e.clientY >= layer.clientHeight) return;
        onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={
          panel
            ? "ql-slide flex h-full w-full max-w-[36rem] flex-col overflow-y-auto overscroll-contain bg-canvas shadow-[-12px_0_40px_rgba(21,24,28,0.18)] outline-none"
            : `ql-rise max-h-[92dvh] w-full overflow-y-auto rounded-t-[16px] bg-white shadow-[0_18px_48px_rgba(21,24,28,0.25)] outline-none sm:my-6 sm:max-h-none sm:overflow-hidden sm:rounded-[16px] ${
                size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg"
              }`
        }
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-start justify-between gap-4 border-b border-[#ECEEF1] px-5 py-4 ${
            panel ? "sticky top-0 z-10 bg-white" : ""
          }`}
        >
          <div className="min-w-0">
            <h2 id={titleId} className="text-[20px] font-semibold leading-tight text-stone-900">{title}</h2>
            {description && (
              <div className="mt-1 text-[15px] text-stone-600">{description}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost tap -mr-1.5 px-1.5"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className={panel ? "flex flex-col gap-4 p-4 sm:p-5" : "px-5 py-5"}>{children}</div>
      </div>
    </div>,
    document.body
  );
}

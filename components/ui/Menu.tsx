"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/** The menu's items a keyboard can move between, in order. */
function items(root: HTMLElement | null): HTMLElement[] {
  return root ? [...root.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)')] : [];
}

/**
 * Compact "…" menu for secondary actions (edit, status, delete), or with
 * `trigger`, a labelled button that opens a list of choices ("Move to").
 * Opening moves focus to the first item; arrow keys, Home and End move
 * between items; Escape closes it and returns focus to the button.
 */
export function Menu({
  children,
  label = "More actions",
  trigger,
  triggerClassName,
  align = "right",
}: {
  children: React.ReactNode;
  label?: string;
  /** Visible button content instead of the "…" icon. */
  trigger?: React.ReactNode;
  triggerClassName?: string;
  /** Which edge of the button the menu lines up with. */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    items(list.current)[0]?.focus();
    const onPointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onListKey = (e: React.KeyboardEvent) => {
    const all = items(list.current);
    if (!all.length) return;
    const at = all.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => {
      e.preventDefault();
      all[(i + all.length) % all.length].focus();
    };
    if (e.key === "ArrowDown") go(at + 1);
    else if (e.key === "ArrowUp") go(at - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(all.length - 1);
    else if (e.key === "Tab") setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={trigger ? undefined : label}
        title={trigger ? undefined : label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={triggerClassName ?? "btn-ghost tap px-1.5"}
      >
        {trigger ?? <MoreHorizontal className="h-4 w-4" />}
      </button>
      {open && (
        <div
          ref={list}
          role="menu"
          aria-label={label}
          onClick={() => setOpen(false)}
          onKeyDown={onListKey}
          className={cn(
            "ql-pop absolute z-30 mt-1 w-60 overflow-hidden rounded-[12px] border border-line bg-white py-1.5 shadow-[0_12px_32px_rgba(16,24,40,0.16)]",
            align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  onClick,
  children,
  danger,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        // Inset focus ring: the menu clips anything drawn outside it.
        "tap flex w-full items-center gap-2 px-4 py-2 text-left text-[14px] transition-colors duration-100 focus-visible:outline-offset-[-3px] disabled:opacity-40",
        danger
          ? "font-semibold text-red-700 hover:bg-red-50 focus-visible:bg-red-50"
          : "text-stone-800 hover:bg-stone-100 focus-visible:bg-stone-100"
      )}
    >
      {children}
    </button>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-4 pb-1 pt-2 text-[12px] font-medium text-stone-400">{children}</div>;
}

export function MenuDivider() {
  return <div className="my-1.5 border-t border-[#ECEEF1]" />;
}

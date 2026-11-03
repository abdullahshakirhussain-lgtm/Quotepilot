"use client";

import { useEffect, useState } from "react";

const SEEN = "qp_greeted";
const PER_LETTER_MS = 40;

/**
 * "Good afternoon, Ana." typed in letter by letter the first time the
 * dashboard opens after signing in (once per browser session), then shown
 * whole. Screen readers get the full sentence at once; reduced motion skips
 * the typing. The space is reserved from the start so nothing jumps.
 */
export function TypedGreeting({ text, className }: { text: string; className?: string }) {
  // null until mounted: rendered invisible so the server and first paint match.
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN) === "1";
      sessionStorage.setItem(SEEN, "1");
    } catch {
      seen = true;
    }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (seen || reduce) {
      setShown(text.length);
      return;
    }
    setShown(0);
    let n = 0;
    const timer = window.setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= text.length) window.clearInterval(timer);
    }, PER_LETTER_MS);
    return () => window.clearInterval(timer);
  }, [text]);

  const typing = shown !== null && shown < text.length;
  return (
    // A span, so it can sit inside a heading; screen readers get the whole text at once.
    <span className={className ? `block ${className}` : undefined}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="relative inline-block">
        {/* Holds the line's full width while the visible part is typed over it. */}
        <span className="invisible">{text}</span>
        <span className="absolute inset-0 whitespace-pre">
          {shown === null ? "" : text.slice(0, shown)}
          {typing && <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[3px] bg-stone-900" />}
        </span>
      </span>
    </span>
  );
}

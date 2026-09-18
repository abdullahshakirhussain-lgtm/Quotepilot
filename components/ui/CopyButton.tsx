"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

/** Shown when the browser won't let QuoteLoop copy (clipboard blocked, older browser). */
export const COPY_FAILED = "Couldn't copy automatically. Select and copy the message manually.";

/**
 * The older copy route, for browsers without the clipboard API (or where it is
 * blocked). The hidden text box goes next to the button, inside any open
 * dialog, so focus never leaves it. True only if the browser says it copied.
 */
function legacyCopy(text: string, button: HTMLButtonElement | null): boolean {
  const host = button?.parentElement ?? document.body;
  const box = document.createElement("textarea");
  box.value = text;
  box.setAttribute("readonly", "");
  box.style.position = "fixed";
  box.style.top = "0";
  box.style.left = "0";
  box.style.opacity = "0";
  host.appendChild(box);
  box.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  host.removeChild(box);
  button?.focus();
  return copied;
}

/**
 * Copies `text`. "Copied!" only appears once the browser confirms the copy;
 * otherwise the user is asked to copy it by hand. `showTextOnFail` also shows
 * the text ready to select, for when it isn't fully visible nearby.
 */
export function CopyButton({
  text,
  className,
  label = "Copy",
  showTextOnFail = false,
}: {
  text: string;
  className?: string;
  label?: string;
  showTextOnFail?: boolean;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const button = useRef<HTMLButtonElement>(null);

  async function copy() {
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      // Blocked, not allowed here, or no clipboard API at all.
      copied = legacyCopy(text, button.current);
    }
    setState(copied ? "copied" : "failed");
    if (copied) setTimeout(() => setState((s) => (s === "copied" ? "idle" : s)), 1800);
  }

  return (
    <>
      <button ref={button} type="button" onClick={copy} className={className ?? "btn-primary"}>
        {state === "copied" ? (
          <>
            <Check className="h-4 w-4" /> Copied!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" /> {label}
          </>
        )}
      </button>
      {state === "failed" && (
        // Last in a row of buttons, on a line of its own.
        <div role="alert" className="order-last w-full basis-full text-xs text-red-700">
          {COPY_FAILED}
          {showTextOnFail && (
            <textarea
              readOnly
              aria-label="Text to copy"
              className="input mt-1.5 min-h-[120px] text-sm text-stone-800"
              value={text}
              onFocus={(e) => e.currentTarget.select()}
            />
          )}
        </div>
      )}
    </>
  );
}

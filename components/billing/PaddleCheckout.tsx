"use client";

import Script from "next/script";
import { useState } from "react";
import { Loader2 } from "lucide-react";

type Paddle = {
  Environment: { set(env: string): void };
  Initialize(options: unknown): void;
};

/**
 * Loads Paddle.js, which opens the checkout for the ?_ptxn= transaction in
 * the address bar. After paying, Paddle sends the buyer back to Settings.
 */
export function PaddleCheckout({ token }: { token: string }) {
  const [state, setState] = useState<"loading" | "open" | "closed" | "failed">("loading");

  function start() {
    const paddle = (window as unknown as { Paddle?: Paddle }).Paddle;
    if (!paddle) return setState("failed");
    try {
      if (token.startsWith("test_")) paddle.Environment.set("sandbox");
      paddle.Initialize({
        token,
        checkout: { settings: { displayMode: "overlay", successUrl: `${window.location.origin}/settings?billing=done#billing` } },
        eventCallback: (event: { name?: string }) => {
          if (event.name === "checkout.loaded") setState("open");
          if (event.name === "checkout.closed") setState("closed");
        },
      });
    } catch {
      setState("failed");
    }
    // Paddle reports some failures (an expired or unknown transaction) only in
    // its own console, so don't spin forever.
    setTimeout(() => setState((s) => (s === "loading" ? "failed" : s)), 20_000);
  }

  return (
    <>
      <Script src="https://cdn.paddle.com/paddle/v2/paddle.js" strategy="afterInteractive" onReady={start} onError={() => setState("failed")} />
      <p role="status" className="mt-3 inline-flex max-w-sm items-center gap-2 text-sm text-stone-600">
        {state === "loading" && (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Opening secure checkout…
          </>
        )}
        {state === "open" && "Complete your payment in the checkout window."}
        {state === "closed" && "Checkout closed. Nothing was charged unless you finished paying."}
        {state === "failed" && "The checkout couldn't open. Check your connection or ad blocker, then start again from Settings."}
      </p>
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

const KEY = "qp_payment_wait";
const EVERY_MS = 4_000;
const MAX_TRIES = 15; // about a minute

/** Drops ?billing=done from the address, so a refresh never shows the return messages again. */
function forgetReturn() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
  const url = new URL(window.location.href);
  if (url.searchParams.has("billing")) {
    url.searchParams.delete("billing");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }
}

/**
 * Back from checkout, before the payment provider has told QuoteLoop. Reloads
 * the page every few seconds (a full reload, see lib/flash.ts) until the
 * subscription shows up; the parent then renders <PaymentConfirmed> instead.
 * Gives up after about a minute with a calmer message.
 */
export function PaymentPending({ contactEmail }: { contactEmail: string }) {
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let tries = 0;
    try {
      tries = Number(sessionStorage.getItem(KEY) ?? 0);
    } catch {}
    if (tries >= MAX_TRIES) {
      setGaveUp(true);
      forgetReturn();
      return;
    }
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(KEY, String(tries + 1));
      } catch {}
      window.location.reload();
    }, EVERY_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <p role="status" className="mb-4 flex items-start gap-2 rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-700 ring-1 ring-inset ring-stone-200">
      {gaveUp ? (
        <>Your payment is taking longer than usual to confirm. It will show here once it does, usually within a few minutes. If it hasn't after an hour, email {contactEmail}.</>
      ) : (
        <>
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
          Confirming your payment… this page updates by itself.
        </>
      )}
    </p>
  );
}

/** The payment is in: a one-time confirmation, gone for good once closed. */
export function PaymentConfirmed({ renewsOn }: { renewsOn: string }) {
  const [open, setOpen] = useState(true);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    forgetReturn();
    button.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 px-4" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-confirmed-title"
        className="card w-full max-w-sm p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <h2 id="payment-confirmed-title" className="mt-3 text-lg font-semibold text-stone-900">
          Payment successful
        </h2>
        <p className="mt-1.5 text-sm text-stone-600">
          You're subscribed to QuoteLoop.{renewsOn ? ` Your plan renews on ${renewsOn}.` : ""} A receipt is on its way to your email.
        </p>
        <button ref={button} type="button" className="btn-primary mt-5 w-full justify-center" onClick={() => setOpen(false)}>
          Continue
        </button>
      </div>
    </div>
  );
}

/** Back from the provider in any other state (canceled, comped…): nothing to show, just tidy the address. */
export function ForgetReturn() {
  useEffect(forgetReturn, []);
  return null;
}

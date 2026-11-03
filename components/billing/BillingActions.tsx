"use client";

import { useState } from "react";
import { CreditCard, Loader2, Mail } from "lucide-react";

/**
 * Subscribe (provider checkout) or Manage billing (provider portal). With no
 * provider connected yet, a plain email link to the owner instead.
 */
export function BillingActions({
  mode,
  providerReady,
  contactEmail,
}: {
  mode: "subscribe" | "manage";
  providerReady: boolean;
  contactEmail: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!providerReady) {
    return (
      <a
        href={`mailto:${contactEmail}?subject=${encodeURIComponent(mode === "subscribe" ? "Subscribe to QuoteLoop" : "My QuoteLoop billing")}`}
        className="btn-primary"
      >
        <Mail className="h-4 w-4" /> {mode === "subscribe" ? "Email us to subscribe" : "Email us about billing"}
      </a>
    );
  }

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(mode === "subscribe" ? "/api/billing/checkout" : "/api/billing/portal", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.url === "string" && /^https:\/\//.test(data.url)) {
        window.location.assign(data.url);
        return;
      }
      setError(data.error || `Payments couldn't be reached just now. Please try again in a minute, or email ${contactEmail}.`);
    } catch {
      setError("QuoteLoop couldn't be reached. Check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      <button type="button" className="btn-primary" disabled={busy} onClick={go}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {mode === "subscribe" ? "Subscribe" : "Manage billing"}
      </button>
      {mode === "manage" && !error && (
        <p className="hint">Opens Paddle, our payment provider. Come back to quoteloop.site/settings when you're done.</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

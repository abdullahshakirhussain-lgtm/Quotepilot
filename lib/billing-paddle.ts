// ---------------------------------------------------------------------------
// Paddle Billing (paddle.com), as the reseller (merchant of record): Paddle
// sells the subscription, charges the card and handles sales tax and VAT.
//
// Server-only settings:
//   PADDLE_API_KEY         pdl_sdbx_apikey_… (sandbox) or pdl_live_apikey_…
//   PADDLE_PRICE_ID        pri_… the monthly price
//   PADDLE_WEBHOOK_SECRET  pdl_ntfset_… from the notification destination
// Browser (baked in at build): NEXT_PUBLIC_PADDLE_CLIENT_TOKEN, test_… or
// live_…, read by the /pay page that opens Paddle's checkout.
//
// Sandbox or live follows the API key's prefix, so the two can't be mixed up.
// ---------------------------------------------------------------------------
import { createHmac, timingSafeEqual } from "node:crypto";
import type { BillingEvent, BillingProvider } from "@/lib/billing-provider";

/** How far a webhook's signed timestamp may be from now. Replays inside it are still applied once (billing_events). */
const SIGNATURE_TOLERANCE_S = 300;
const CUSTOMER_ID = /^ctm_[a-z\d]{26}$/;

type Env = Record<string, string | undefined>;

interface PaddleSubscription {
  id?: string;
  status?: string;
  customer_id?: string;
  custom_data?: { user_id?: unknown } | null;
  current_billing_period?: { ends_at?: string } | null;
  scheduled_change?: { action?: string; effective_at?: string } | null;
}

/** Null (with a log line) when a setting is missing: the app then says payments aren't set up. */
export function makePaddleProvider(env: Env = process.env, fetchImpl: typeof fetch = fetch): BillingProvider | null {
  const apiKey = env.PADDLE_API_KEY?.trim();
  const priceId = env.PADDLE_PRICE_ID?.trim();
  const webhookSecret = env.PADDLE_WEBHOOK_SECRET?.trim();
  const missing = [!apiKey && "PADDLE_API_KEY", !priceId && "PADDLE_PRICE_ID", !webhookSecret && "PADDLE_WEBHOOK_SECRET"].filter(Boolean);
  if (missing.length) {
    console.error(`[billing] BILLING_PROVIDER=paddle but ${missing.join(", ")} isn't set`);
    return null;
  }
  const baseUrl = apiKey!.startsWith("pdl_sdbx_") ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";
  const appUrl = (env.APP_URL || "https://quoteloop.site").replace(/\/+$/, "");

  async function call(path: string, body: unknown) {
    const res = await fetchImpl(`${baseUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Paddle-Version": "1" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = json?.error?.code ?? json?.error?.detail ?? "";
      throw new Error(`Paddle ${path} answered ${res.status} ${detail}`.trim());
    }
    return json?.data;
  }

  return {
    name: "paddle",

    async createCheckout({ userId }) {
      // Paddle's checkout link is our /pay page plus ?_ptxn=<transaction>; the
      // page loads Paddle.js, which opens the checkout for that transaction.
      // user_id is copied onto the subscription and comes back on its events.
      const data = await call("/transactions", {
        items: [{ price_id: priceId, quantity: 1 }],
        custom_data: { user_id: userId },
        checkout: { url: `${appUrl}/pay` },
      });
      const url = data?.checkout?.url;
      if (typeof url !== "string" || !/^https:\/\//.test(url)) throw new Error("Paddle returned no checkout link");
      return { url };
    },

    async createPortal({ customerId }) {
      if (!CUSTOMER_ID.test(customerId)) throw new Error("not a Paddle customer id");
      const data = await call(`/customers/${customerId}/portal-sessions`, {});
      const url = data?.urls?.general?.overview;
      if (typeof url !== "string" || !/^https:\/\//.test(url)) throw new Error("Paddle returned no portal link");
      return { url };
    },

    async parseWebhook(request, rawBody) {
      verifySignature(request.headers.get("paddle-signature"), rawBody, webhookSecret!);
      const payload = JSON.parse(rawBody);
      const event = toBillingEvent(payload);
      return event ? [event] : [];
    },
  };
}

/** Throws unless `Paddle-Signature` (ts=…;h1=…) is an HMAC-SHA256 of `ts:body` with the secret, signed recently. */
export function verifySignature(header: string | null, rawBody: string, secret: string, now: number = Date.now()) {
  if (!header) throw new Error("no Paddle-Signature header");
  let ts = "";
  const signatures: string[] = [];
  for (const part of header.split(";")) {
    const [key, value] = part.split("=", 2).map((s) => s?.trim() ?? "");
    if (key === "ts") ts = value;
    else if (key === "h1" && value) signatures.push(value);
  }
  if (!/^\d+$/.test(ts) || !signatures.length) throw new Error("malformed Paddle-Signature header");
  if (Math.abs(now / 1000 - Number(ts)) > SIGNATURE_TOLERANCE_S) throw new Error("Paddle-Signature timestamp is too old or in the future");

  const expected = createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest();
  // More than one h1 while Paddle rotates a secret: any match will do.
  const ok = signatures.some((sig) => {
    if (!/^[0-9a-f]+$/i.test(sig)) return false;
    const given = Buffer.from(sig, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!ok) throw new Error("Paddle-Signature doesn't match");
}

/**
 * One of Paddle's subscription.* notifications as a plain billing event, or
 * null for anything else. Every subscription event carries the whole
 * subscription, so its current status decides, whichever event it was.
 */
export function toBillingEvent(payload: unknown): BillingEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const { event_id, event_type, occurred_at, data } = payload as {
    event_id?: unknown;
    event_type?: unknown;
    occurred_at?: unknown;
    data?: PaddleSubscription;
  };
  if (typeof event_id !== "string" || typeof event_type !== "string" || !event_type.startsWith("subscription.")) return null;
  if (typeof occurred_at !== "string" || !data || typeof data !== "object") return null;

  const userId = typeof data.custom_data?.user_id === "string" ? data.custom_data.user_id : null;
  const periodEnd = data.current_billing_period?.ends_at ?? null;
  const base = {
    id: event_id,
    occurredAt: occurred_at,
    userId,
    customerId: data.customer_id ?? null,
    subscriptionId: data.id ?? null,
  };

  switch (data.status) {
    case "active":
      // Canceled from the portal: Paddle keeps it active until the period
      // ends, with the cancellation scheduled.
      if (data.scheduled_change?.action === "cancel") {
        return { ...base, type: "subscription_canceled", currentPeriodEnd: data.scheduled_change.effective_at ?? periodEnd, cancelAtPeriodEnd: true };
      }
      return { ...base, type: "subscription_active", currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false };
    case "past_due":
      return { ...base, type: "payment_failed" };
    // Canceled is Paddle's final state (the paid period is over, or payment
    // retries ran out). Pausing isn't offered, so treat it the same way.
    case "canceled":
    case "paused":
      return { ...base, type: "subscription_expired" };
    default:
      // "trialing": QuoteLoop's own trial needs no card, so Paddle never runs one.
      return null;
  }
}

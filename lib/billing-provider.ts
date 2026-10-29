// ---------------------------------------------------------------------------
// The one place a payment provider plugs in. Until BILLING_PROVIDER names an
// adapter here, checkout and the billing portal say payments aren't set up,
// and the webhook endpoint answers 404. Wiring one in means: an adapter that
// implements BillingProvider (its checkout, portal and webhook-signature
// checks), registered in ADAPTERS.
//
// Provider events are translated into a handful of plain events, and
// applyBillingEvent turns those into a subscription change. That part is pure
// and provider-neutral, so it is tested once for every provider.
// ---------------------------------------------------------------------------
import { GRACE_DAYS, type SubscriptionRow, type SubscriptionStatus } from "@/lib/billing";

export type BillingEventType =
  /** Paid: first payment or a renewal. */
  | "subscription_active"
  /** A renewal payment failed; the provider will retry. */
  | "payment_failed"
  /** Canceled; access continues until the end of the paid period. */
  | "subscription_canceled"
  /** Access is over (canceled period ended, or retries ran out). */
  | "subscription_expired";

export interface BillingEvent {
  /** The provider's own event id: each one is applied once. */
  id: string;
  type: BillingEventType;
  /** When it happened at the provider (ISO). Older than the last applied: ignored. */
  occurredAt: string;
  /** QuoteLoop user id, passed to checkout and echoed back by the provider. */
  userId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  /** Paid until (subscription_active / subscription_canceled). */
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
}

export interface BillingProvider {
  name: string;
  /** A hosted checkout page for this user; `userId` must come back on its events. */
  createCheckout(input: { userId: string; email: string | null; returnUrl: string }): Promise<{ url: string }>;
  /** The provider's page for updating the card, invoices and canceling. */
  createPortal(input: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  /** Verifies the webhook's signature (throw when it doesn't match) and translates it. */
  parseWebhook(request: Request, rawBody: string): Promise<BillingEvent[]>;
}

/** Adapters by name (BILLING_PROVIDER). None yet: payments aren't set up. */
const ADAPTERS: Record<string, () => BillingProvider> = {};

let testProvider: BillingProvider | null = null;
/** Tests only: stand in for a real provider. Ignored in production. */
export function setBillingProviderForTests(provider: BillingProvider | null) {
  if (process.env.NODE_ENV === "production") return;
  testProvider = provider;
}

export function getBillingProvider(): BillingProvider | null {
  if (testProvider && process.env.NODE_ENV !== "production") return testProvider;
  const name = (process.env.BILLING_PROVIDER ?? "").trim().toLowerCase();
  const make = name ? ADAPTERS[name] : undefined;
  return make ? make() : null;
}

export interface SubscriptionForEvents extends SubscriptionRow {
  last_event_at?: string | null;
  provider_subscription_id?: string | null;
}

export type SubscriptionPatch = Partial<{
  status: SubscriptionStatus;
  current_period_end: string | null;
  grace_ends_at: string | null;
  cancel_at_period_end: boolean;
  provider: string;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  last_event_at: string;
}>;

/**
 * The subscription change one provider event makes, or null when it changes
 * nothing (an event older than one already applied arrived late).
 */
export function applyBillingEvent(
  sub: SubscriptionForEvents,
  event: BillingEvent,
  providerName: string
): SubscriptionPatch | null {
  const at = Date.parse(event.occurredAt);
  if (Number.isNaN(at)) return null;
  if (sub.last_event_at && at < Date.parse(sub.last_event_at)) return null;

  const base: SubscriptionPatch = {
    provider: providerName,
    last_event_at: new Date(at).toISOString(),
    ...(event.customerId ? { provider_customer_id: event.customerId } : {}),
    ...(event.subscriptionId ? { provider_subscription_id: event.subscriptionId } : {}),
  };

  switch (event.type) {
    case "subscription_active":
      return {
        ...base,
        status: "active",
        current_period_end: event.currentPeriodEnd ?? sub.current_period_end ?? null,
        cancel_at_period_end: Boolean(event.cancelAtPeriodEnd),
        grace_ends_at: null,
      };
    case "payment_failed":
      return {
        ...base,
        status: "past_due",
        // Grace runs from the FIRST failure: further retries don't extend it.
        grace_ends_at:
          sub.status === "past_due" && sub.grace_ends_at
            ? sub.grace_ends_at
            : new Date(at + GRACE_DAYS * 86_400_000).toISOString(),
      };
    case "subscription_canceled":
      return {
        ...base,
        status: "canceled",
        current_period_end: event.currentPeriodEnd ?? sub.current_period_end ?? null,
        cancel_at_period_end: true,
        grace_ends_at: null,
      };
    case "subscription_expired":
      return { ...base, status: "expired", grace_ends_at: null };
    default:
      return null;
  }
}

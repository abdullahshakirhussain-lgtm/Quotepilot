import { NextResponse } from "next/server";
import { alertOwner } from "@/lib/billing-alert";
import {
  applyBillingEvent,
  getBillingProvider,
  isSecondLiveSubscription,
  liveOtherSubscription,
  type BillingEvent,
  type SubscriptionForEvents,
  type SubscriptionPatch,
} from "@/lib/billing-provider";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify, type NotificationKind } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Malformed ids or dates are kept out of typed columns (they stay in the
// payload), so a bad event is recorded and acknowledged, never retried forever.
const asUuid = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);
const asTime = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null);

const RETRY = () => NextResponse.json({ error: "Try again." }, { status: 500 }); // the provider retries
const NO_ACCOUNT_YET: SubscriptionForEvents = { status: "expired", trial_ends_at: null, current_period_end: null, grace_ends_at: null };

type Db = NonNullable<ReturnType<typeof createAdminClient>>;
type Sub = SubscriptionForEvents & { user_id: string };

/** The account an event is about: by our user id, then the provider's subscription id, then its customer id. */
async function findSubscription(db: Db, providerName: string, event: BillingEvent): Promise<{ sub: Sub | null; failed: boolean }> {
  const userId = asUuid(event.userId);
  const lookups: [string, string | null | undefined][] = userId
    ? [["user_id", userId]]
    : [["provider_subscription_id", event.subscriptionId], ["provider_customer_id", event.customerId]];
  for (const [column, value] of lookups) {
    if (!value) continue;
    let query = db.from("subscriptions").select("*").eq(column, value);
    if (!userId) query = query.eq("provider", providerName);
    const { data, error } = await query.limit(2);
    if (error) {
      console.error("[billing] couldn't look up an account:", error.message);
      return { sub: null, failed: true };
    }
    // One provider customer can pay for two accounts (the same email at
    // checkout). Then only our own user id can say which one this is about.
    if (data.length > 1) {
      console.error("[billing] more than one account matches", column);
      return { sub: null, failed: false };
    }
    if (data.length) return { sub: data[0] as Sub, failed: false };
  }
  return { sub: null, failed: false };
}

/**
 * The payment provider's notifications. Each is verified by the provider's
 * adapter, recorded by its id, and applied to the matching account unless a
 * newer event already was. An event only counts as done once processed_at is
 * set: a repeat of a finished one is skipped, and a retry after anything went
 * wrong partway through applies it.
 */
export async function POST(request: Request) {
  const provider = getBillingProvider();
  if (!provider) return NextResponse.json({ error: "Billing isn't set up." }, { status: 404 });
  const db = createAdminClient();
  if (!db) {
    console.error("[billing] webhook received but SUPABASE_SERVICE_ROLE_KEY isn't set");
    return NextResponse.json({ error: "Billing isn't configured on the server." }, { status: 503 });
  }

  const raw = await request.text();
  let events;
  try {
    events = await provider.parseWebhook(request, raw);
  } catch (e) {
    console.error("[billing] rejected a webhook:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Invalid webhook." }, { status: 400 });
  }

  for (const event of events) {
    if (!event?.id) {
      console.error("[billing] skipped an event with no id");
      continue;
    }
    const eventKey = `${provider.name}:${event.id}`;
    const { data: inserted, error: insertError } = await db
      .from("billing_events")
      .upsert(
        { id: eventKey, provider: provider.name, type: String(event.type), user_id: asUuid(event.userId), occurred_at: asTime(event.occurredAt), payload: event },
        { onConflict: "id", ignoreDuplicates: true }
      )
      .select("id");
    if (insertError) {
      console.error("[billing] couldn't record event", eventKey, insertError.message);
      return RETRY();
    }
    if (!inserted?.length) {
      const { data: seen, error: seenError } = await db.from("billing_events").select("processed_at").eq("id", eventKey).maybeSingle();
      if (seenError) {
        console.error("[billing] couldn't check event", eventKey, seenError.message);
        return RETRY();
      }
      if (seen?.processed_at) continue;
    }

    const { sub, failed } = await findSubscription(db, provider.name, event);
    if (failed) return RETRY();

    const done = () => db.from("billing_events").update({ processed_at: new Date().toISOString() }).eq("id", eventKey);

    if (event.type === "payment_reversed") {
      alertOwner(
        "money went back to a customer",
        `${event.detail ?? "A payment was reversed"}. Provider: ${provider.name}. Subscription: ${event.subscriptionId ?? "none"}. Customer: ${event.customerId ?? "none"}. QuoteLoop account: ${sub?.user_id ?? "not matched"}. QuoteLoop did not change this account's access; if they should lose it, cancel the subscription with the provider.`
      );
      await done();
      continue;
    }

    if (!sub) {
      const userId = asUuid(event.userId);
      if (!userId) {
        console.error("[billing] event", eventKey, "names no account");
        continue;
      }
      // A real payment for an account with no subscription row (its trial
      // never managed to start): it still has to count.
      const patch = applyBillingEvent(NO_ACCOUNT_YET, event, provider.name);
      if (patch) {
        const { error: createError } = await db.from("subscriptions").upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
        if (createError?.code === "23503") {
          console.error("[billing] event", eventKey, "is for an account that no longer exists");
          continue;
        }
        if (createError) {
          console.error("[billing] couldn't create a subscription for event", eventKey, createError.message);
          return RETRY();
        }
      }
      await done();
      continue;
    }

    let patch: SubscriptionPatch | null = applyBillingEvent(sub, event, provider.name);
    if (isSecondLiveSubscription(sub, event)) {
      alertOwner(
        "a customer is paying for two subscriptions",
        `Provider: ${provider.name}. Subscriptions: ${sub.provider_subscription_id} and ${event.subscriptionId}. Customer: ${event.customerId ?? "none"}. QuoteLoop account: ${sub.user_id}. Cancel and refund one of them with the provider.`
      );
    }
    if (patch && event.type === "subscription_expired") {
      const { data: history, error: historyError } = await db.from("billing_events").select("payload").eq("user_id", sub.user_id).eq("provider", provider.name);
      if (historyError) {
        console.error("[billing] couldn't read the history for event", eventKey, historyError.message);
        return RETRY();
      }
      const other = liveOtherSubscription((history ?? []).map((row) => row.payload as BillingEvent), event.subscriptionId ?? sub.provider_subscription_id);
      if (other) {
        const fromOther = applyBillingEvent({ ...sub, status: "expired", last_event_at: null, provider_subscription_id: other.subscriptionId }, other, provider.name);
        if (fromOther) patch = { ...fromOther, last_event_at: patch.last_event_at };
      }
    }
    if (patch) {
      const { error: updateError } = await db.from("subscriptions").update(patch).eq("user_id", sub.user_id);
      if (updateError) {
        console.error("[billing] couldn't apply event", eventKey, updateError.message);
        return RETRY();
      }
      await notifyBilling(db, sub.user_id, event, patch);
    }
    await done();
  }
  return NextResponse.json({ received: true });
}

/** The account holder's update under the bell for a billing change that was applied. */
async function notifyBilling(db: Db, userId: string, event: BillingEvent, patch: SubscriptionPatch) {
  const until = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : null;
  const end = until((patch as { current_period_end?: string | null }).current_period_end ?? event.currentPeriodEnd);
  const messages: Record<BillingEvent["type"], [NotificationKind, string, string]> = {
    subscription_active: ["payment_received", "Your payment went through", end ? `QuoteLoop is paid until ${end}.` : "Your subscription is active."],
    payment_failed: ["payment_failed", "A payment didn't go through", "It will be tried again. Update your card in Settings, Billing, to keep full access."],
    subscription_canceled: ["subscription_canceled", "Your subscription was canceled", end ? `You keep full access until ${end}.` : "You keep full access until the end of the paid period."],
    subscription_expired: ["subscription_expired", "Your subscription has ended", "Your data is safe and you can still read it. Subscribe again in Settings to keep following up."],
    payment_reversed: ["payment_reversed", "A payment was refunded", "The money went back to your card."],
  };
  const [kind, title, body] = messages[event.type];
  await notify(db, { userId, kind, title, body, dedupeKey: `billing:${event.id}` });
}

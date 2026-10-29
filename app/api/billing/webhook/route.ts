import { NextResponse } from "next/server";
import { applyBillingEvent, getBillingProvider, type SubscriptionForEvents } from "@/lib/billing-provider";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Malformed ids or dates are kept out of typed columns (they stay in the
// payload), so a bad event is recorded and acknowledged, never retried forever.
const asUuid = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);
const asTime = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null);

/**
 * The payment provider's notifications. Each is verified by the provider's
 * adapter, recorded once by its id (a repeat is acknowledged and skipped), and
 * applied to the matching account unless a newer event already was.
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
    // Recorded first, by id: a repeated delivery stops here.
    const { data: inserted, error: insertError } = await db
      .from("billing_events")
      .upsert(
        { id: eventKey, provider: provider.name, type: String(event.type), user_id: asUuid(event.userId), occurred_at: asTime(event.occurredAt), payload: event },
        { onConflict: "id", ignoreDuplicates: true }
      )
      .select("id");
    if (insertError) {
      console.error("[billing] couldn't record event", eventKey, insertError.message);
      return NextResponse.json({ error: "Try again." }, { status: 500 }); // the provider retries
    }
    if (!inserted?.length) continue;

    let query = db.from("subscriptions").select("*");
    const userId = asUuid(event.userId);
    if (userId) query = query.eq("user_id", userId);
    else if (event.customerId) query = query.eq("provider", provider.name).eq("provider_customer_id", event.customerId);
    else {
      console.error("[billing] event", eventKey, "names no account");
      continue;
    }
    const { data: sub, error: subError } = await query.maybeSingle<SubscriptionForEvents & { user_id: string }>();
    if (subError || !sub) {
      console.error("[billing] no subscription for event", eventKey, subError?.message ?? "");
      continue;
    }

    const patch = applyBillingEvent(sub, event, provider.name);
    if (patch) {
      const { error: updateError } = await db.from("subscriptions").update(patch).eq("user_id", sub.user_id);
      if (updateError) {
        console.error("[billing] couldn't apply event", eventKey, updateError.message);
        // Un-record it so the provider's retry applies it.
        await db.from("billing_events").delete().eq("id", eventKey);
        return NextResponse.json({ error: "Try again." }, { status: 500 });
      }
    }
    await db.from("billing_events").update({ processed_at: new Date().toISOString() }).eq("id", eventKey);
  }
  return NextResponse.json({ received: true });
}

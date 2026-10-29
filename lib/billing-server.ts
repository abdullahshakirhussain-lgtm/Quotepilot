import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { accessFrom, READ_ONLY_MESSAGE, type Access, type SubscriptionRow } from "@/lib/billing";

export interface AccountAccess extends Access {
  subscription: SubscriptionRow | null;
  /** Whether read-only is actually enforced (BILLING_ENFORCEMENT, default on). */
  enforced: boolean;
}

/** BILLING_ENFORCEMENT=off shows trial and billing banners but never locks anyone. */
export function billingEnforced(): boolean {
  return (process.env.BILLING_ENFORCEMENT ?? "on").trim().toLowerCase() !== "off";
}

/**
 * The signed-in user's subscription and what it allows, once per request.
 * Their trial starts here the first time (start_trial fixes its length).
 * A subscription that can't be read never locks anyone out: QuoteLoop errs on
 * the side of letting a paying customer work.
 */
export const getAccess = cache(async (userId: string): Promise<AccountAccess> => {
  const enforced = billingEnforced();
  const supabase = await createClient();
  let subscription: SubscriptionRow | null = null;
  try {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("status, plan, trial_ends_at, current_period_end, grace_ends_at, cancel_at_period_end, provider, provider_customer_id")
      .eq("user_id", userId)
      .maybeSingle<SubscriptionRow>();
    if (error) throw error;
    subscription = data;
    if (!subscription) {
      const started = await supabase.rpc("start_trial");
      if (started.error) throw started.error;
      // A single row; tolerate a list too.
      const row = Array.isArray(started.data) ? started.data[0] : started.data;
      subscription = (row as SubscriptionRow | null) ?? null;
    }
  } catch (e) {
    // Includes the billing tables not existing yet (schema not run).
    console.error("[billing] couldn't read the subscription:", e instanceof Error ? e.message : (e as { message?: string })?.message ?? e);
    subscription = null;
  }
  const access = accessFrom(subscription, new Date());
  return { ...access, canWrite: enforced ? access.canWrite : true, subscription, enforced };
});

/**
 * For every action that creates, sends or drafts: null when allowed, or the
 * message to show when the account is read-only.
 */
export async function readOnlyReason(userId: string): Promise<string | null> {
  const access = await getAccess(userId);
  return access.canWrite ? null : READ_ONLY_MESSAGE;
}

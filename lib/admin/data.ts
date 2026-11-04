// Everything the admin reads, with the service role, on the server only.
// Only dates, counts and states are selected: never the content of anyone's
// quotes, customers or messages (see the privacy policy).
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { SubscriptionStatus } from "@/lib/billing";

export interface AdminAccountRow {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
}
export interface AdminSubscriptionRow {
  user_id: string;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  grace_ends_at: string | null;
  cancel_at_period_end: boolean | null;
  provider_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminData {
  accounts: AdminAccountRow[];
  businesses: { user_id: string; business_name: string; industry: string; currency: string; created_at: string }[];
  subscriptions: AdminSubscriptionRow[];
  quotes: { user_id: string; status: string; created_at: string }[];
  followUpsDone: { user_id: string; completed_at: string | null }[];
  emails: { user_id: string; status: string; created_at: string; error_message: string | null }[];
  messages: { user_id: string; created_at: string }[];
  aiDrafts: { user_id: string; created_at: string }[];
  replies: { user_id: string; received_at: string; forward_error: string | null }[];
  billingEvents: { id: string; type: string; user_id: string | null; occurred_at: string | null; received_at: string; processed_at: string | null }[];
  /** The last 90 days of page visits (the table keeps 13 months). */
  visits: { user_id: string; path: string; device: string; at: string }[];
  /** Tables that aren't there yet (the admin SQL not run): shown, never thrown. */
  missing: string[];
}

const VISIT_DAYS = 90;

export async function loadAdminData(db: SupabaseClient, now = new Date()): Promise<AdminData> {
  const missing: string[] = [];
  // A table from a later SQL file may not exist yet: an empty list, and a note.
  const optional = async <T>(name: string, read: () => Promise<T[]>): Promise<T[]> => {
    try {
      return await read();
    } catch (e) {
      if (/does not exist|PGRST20[25]|42P01|42883|schema cache/i.test(String((e as Error)?.message ?? e))) {
        missing.push(name);
        return [];
      }
      throw e;
    }
  };
  const all = <T>(table: string, columns: string, order = "id") =>
    fetchAllRows<T>((from, to) => db.from(table).select(columns).order(order).range(from, to) as never);

  const since = new Date(now.getTime() - VISIT_DAYS * 86_400_000).toISOString();
  const [accounts, businesses, subscriptions, quotes, followUpsDone, emails, messages, aiDrafts, replies, billingEvents, visits] =
    await Promise.all([
      optional<AdminAccountRow>("admin_accounts()", async () => {
        const { data, error } = await db.rpc("admin_accounts");
        if (error) throw new Error(`${error.code} ${error.message}`);
        return (data ?? []) as AdminAccountRow[];
      }),
      all<AdminData["businesses"][number]>("businesses", "user_id, business_name, industry, currency, created_at"),
      all<AdminSubscriptionRow>(
        "subscriptions",
        "user_id, status, trial_ends_at, current_period_end, grace_ends_at, cancel_at_period_end, provider_subscription_id, created_at, updated_at",
        "user_id"
      ),
      all<AdminData["quotes"][number]>("quotes", "user_id, status, created_at"),
      fetchAllRows<AdminData["followUpsDone"][number]>((from, to) =>
        db.from("follow_ups").select("user_id, completed_at").eq("status", "completed").order("id").range(from, to) as never
      ),
      all<AdminData["emails"][number]>("email_logs", "user_id, status, created_at, error_message"),
      all<AdminData["messages"][number]>("messages", "user_id, created_at"),
      all<AdminData["aiDrafts"][number]>("ai_usage", "user_id, created_at"),
      optional("customer_replies", () => all<AdminData["replies"][number]>("customer_replies", "user_id, received_at, forward_error")),
      all<AdminData["billingEvents"][number]>("billing_events", "id, type, user_id, occurred_at, received_at, processed_at"),
      optional("app_events", () =>
        fetchAllRows<AdminData["visits"][number]>((from, to) =>
          db.from("app_events").select("user_id, path, device, at").gte("at", since).order("id").range(from, to) as never
        )
      ),
    ]);

  return { accounts, businesses, subscriptions, quotes, followUpsDone, emails, messages, aiDrafts, replies, billingEvents, visits, missing };
}

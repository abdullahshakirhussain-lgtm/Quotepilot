// A Supabase client with the service role, which bypasses row-level security.
// Server only, and only where no user is signed in: the payment webhook.
// Never import this from a component or anything the browser loads.
import { createClient as createSupabase, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";

/** null when SUPABASE_SERVICE_ROLE_KEY isn't set (billing webhooks then answer 503). */
export function createAdminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  const { url } = getSupabaseEnv();
  return createSupabase(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

// Browser Supabase client for use inside Client Components.
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}

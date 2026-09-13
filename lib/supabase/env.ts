// Reads the Supabase connection settings with a clear error when they're
// missing, instead of the SDK's generic "URL and Key are required" crash.
// The NEXT_PUBLIC_* names must stay written out literally so Next.js can inline
// them into the browser bundle.

export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.local.example), then rebuild."
    );
  }
  return { url, anonKey };
}

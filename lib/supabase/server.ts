import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server Supabase client for Server Components, Server Actions and Route Handlers.
// `cookies()` is async in Next.js 15, hence this helper is async too.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            options?: any;
          }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // `setAll` was called from a Server Component. This can be ignored
            // because the middleware refreshes the session cookies on each request.
          }
        },
      },
    }
  );
}

/**
 * Returns the authenticated user or null. Uses getUser() (validates the token
 * with Supabase) rather than getSession() for security.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

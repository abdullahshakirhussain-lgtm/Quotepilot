import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv } from "./env";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/leads",
  "/quotes",
  "/follow-ups",
  "/pipeline",
  "/settings",
  "/onboarding",
  "/reset-password",
];

/**
 * Pages only for signed-out visitors: the landing page, log in and sign up.
 * They offer to sign in, so a signed-in user goes straight into the app.
 */
const SIGNED_OUT_PAGES = new Set(["/", "/login", "/signup"]);

/**
 * Where a signed-in user belongs. Onboarding is complete once their workspace
 * (business profile) exists — the same rule the app layout and the onboarding
 * page apply. If the lookup fails, the dashboard: it explains the problem
 * instead of sending an existing user back through onboarding.
 */
async function appHome(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return "/dashboard";
  return data ? "/dashboard" : "/onboarding";
}

/**
 * Refreshes the Supabase auth session on every request and gates protected
 * routes. Returns the response that must be returned from `middleware.ts`.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Without Supabase settings every request would 500 with a cryptic SDK error
  // (including the public landing page). Let requests through instead; any
  // page that needs data fails with a clear configuration error.
  if (!hasSupabaseEnv()) {
    console.error(
      "[quoteloop] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set."
    );
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            options?: any;
          }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() must be called to refresh the token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /**
   * A redirect that carries any session cookies just refreshed above (a
   * returning visitor's token has usually expired; without them the browser
   * would keep the old ones) and that no shared cache may keep, since where it
   * points depends on who is signed in. Next sends same-site redirects from
   * middleware as relative paths, so the host behind the proxy never leaks.
   */
  const redirect = (url: URL) => {
    const response = NextResponse.redirect(url);
    for (const cookie of supabaseResponse.cookies.getAll()) response.cookies.set(cookie);
    response.headers.set("cache-control", "private, no-store");
    return response;
  };

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Keep the whole destination (e.g. /quotes?new=1) in a single param.
    url.search = "";
    url.searchParams.set("redirect", path + request.nextUrl.search);
    return redirect(url);
  }

  if (user && SIGNED_OUT_PAGES.has(path)) {
    const url = request.nextUrl.clone();
    url.pathname = await appHome(supabase, user.id);
    url.search = "";
    return redirect(url);
  }

  return supabaseResponse;
}

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Sends the browser on to a path on this same site. The Location is relative,
 * so the browser resolves it against the address it actually used: it works
 * the same behind the hosting proxy and on localhost, and no request header (a
 * spoofed X-Forwarded-Host, say) can point it at another site.
 */
function goTo(path: string) {
  return new NextResponse(null, { status: 303, headers: { location: path, "cache-control": "no-store" } });
}

/**
 * Google sign-in, email-confirmation and password-reset links land here with a
 * one-time code. We exchange it for a session cookie and continue to a
 * same-site path only. Users without a workspace are sent on to onboarding by
 * the app layout.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return goTo(next);
    console.error("[auth] code exchange failed:", error.message);
  }

  // A password reset link that didn't work (expired, already used, or opened
  // in a different browser): straight to where a new one can be requested.
  if (next === "/reset-password") return goTo("/forgot-password?error=link");
  // Cancelled consent, an expired confirmation link, or a provider error.
  return goTo("/login?error=oauth");
}

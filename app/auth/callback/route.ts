import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** The public origin, even when a proxy (Railway/Vercel) terminates TLS. */
function publicOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (host && process.env.NODE_ENV !== "development") {
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    return `${proto}://${host}`;
  }
  return request.nextUrl.origin;
}

/**
 * Google sign-in and email-confirmation links land here with a one-time code.
 * We exchange it for a session cookie and continue to a same-site path only.
 * Users without a workspace are sent on to onboarding by the app layout.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"));
  const origin = publicOrigin(request);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error("[auth] code exchange failed:", error.message);
  }

  // Cancelled consent, expired link, or a provider error.
  return NextResponse.redirect(`${origin}/login?error=oauth`);
}

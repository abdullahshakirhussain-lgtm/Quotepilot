import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * Signs out and returns to the login page. The Location is relative: behind
 * the hosting proxy the server only knows its own internal address, so a URL
 * built from the request would send the browser to an unreachable localhost.
 */
export async function POST() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    // Supabase couldn't be reached: still forget the session in this browser.
    console.error("[auth] sign-out failed:", error.message);
    const store = await cookies();
    for (const c of store.getAll()) if (c.name.startsWith("sb-")) store.delete(c.name);
  }
  return new NextResponse(null, { status: 303, headers: { location: "/login", "cache-control": "no-store" } });
}

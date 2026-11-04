import { NextResponse } from "next/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/notifications: the signed-in user's latest updates, newest first.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, quote_id, title, body, created_at, read_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) {
    console.error("[updates] loading updates failed:", error.message);
    return NextResponse.json({ error: "Your updates couldn't be loaded just now. Try again." }, { status: 500 });
  }
  return NextResponse.json({ notifications: data ?? [] });
}

// POST /api/notifications {op: "read_all"} or {op: "read", id}: mark as read.
// A plain request, not a server action: those can stall on the dashboard (Next 15.5).
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ ok: false }, { status: 415 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  let body: { op?: string; id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const supabase = await createClient();
  let query = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  if (body.op === "read") {
    if (!UUID.test(String(body.id ?? ""))) return NextResponse.json({ ok: false }, { status: 400 });
    query = query.eq("id", body.id!);
  } else if (body.op !== "read_all") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const { error } = await query;
  if (error) {
    console.error("[updates] marking updates read failed:", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

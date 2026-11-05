import { NextResponse } from "next/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { isPublicHttpsUrl, relayConfig } from "@/lib/reply-relay";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A short page for a file that can't be opened: it was also forwarded to the inbox. */
function unavailable(reason: string, status: number) {
  return new NextResponse(
    `${reason} The customer's email, with this file, was also forwarded to your business email, so it's in your inbox.`,
    { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } }
  );
}

/**
 * GET /api/replies/:id/files/:n: opens the n-th file a customer attached to
 * their reply. Only the reply's owner gets it. Nothing is stored in QuoteLoop:
 * Resend keeps the received email, and hands out a link to the file that works
 * for an hour, so each click asks for a fresh one.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; n: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, n } = await params;
  const index = Number(n);
  if (!UUID.test(id) || !Number.isInteger(index) || index < 0 || index > 99) return unavailable("This file couldn't be found.", 404);

  const supabase = await createClient();
  const { data: reply, error } = await supabase
    .from("customer_replies")
    .select("resend_email_id, attachment_names")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[replies] looking up a reply's file failed:", error.message);
    return unavailable("This file couldn't be opened just now. Try again in a moment.", 503);
  }
  const names = (reply?.attachment_names ?? []) as string[];
  const name = names[index];
  if (!reply?.resend_email_id || !name) return unavailable("This file couldn't be found.", 404);

  const relay = relayConfig();
  if (!relay) return unavailable("Files from replies can't be opened in QuoteLoop right now.", 503);

  let files: { filename?: string | null; download_url?: string | null }[];
  try {
    const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(reply.resend_email_id as string)}/attachments?limit=100`, {
      headers: { authorization: `Bearer ${relay.apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404) return unavailable("This file is no longer kept by QuoteLoop's email service.", 404);
    if (!res.ok) {
      console.error(`[replies] listing a reply's files: Resend returned ${res.status}`);
      return unavailable("This file couldn't be opened just now. Try again in a moment.", 503);
    }
    files = ((await res.json()) as { data?: typeof files }).data ?? [];
  } catch (e) {
    console.error("[replies] listing a reply's files failed:", e instanceof Error ? e.message : e);
    return unavailable("This file couldn't be opened just now. Try again in a moment.", 503);
  }

  // The same file name can appear twice: take the one in the same place.
  const nth = names.slice(0, index).filter((x) => x === name).length;
  const match = files.filter((f) => (f.filename ?? "").slice(0, 200) === name)[nth] ?? null;
  const url = match?.download_url ?? "";
  if (!isPublicHttpsUrl(url)) return unavailable("This file is no longer kept by QuoteLoop's email service.", 404);
  return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } });
}

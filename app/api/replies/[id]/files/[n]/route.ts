import { NextResponse } from "next/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { fetchPublic, isPublicHttpsUrl, relayConfig } from "@/lib/reply-relay";
import { canViewInBrowser, safeFilename, sniffKind } from "@/lib/attachments";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Larger files aren't opened here; they're in the inbox the reply was forwarded to. */
const MAX_VIEW_BYTES = 25 * 1024 * 1024;

/** A short page for a file that can't be opened: it was also forwarded to the inbox. */
function unavailable(reason: string, status: number) {
  return new NextResponse(
    `${reason} The customer's email, with this file, was also forwarded to your business email, so it's in your inbox.`,
    {
      status,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
      },
    }
  );
}

/**
 * GET /api/replies/:id/files/:n: shows the n-th file a customer attached to
 * their reply, in the browser. Only the reply's owner gets it, and only a PDF
 * or a photo, checked by its content: anything else (a Word file, a zip, a
 * program) is never opened or downloaded from QuoteLoop; it's in the inbox.
 * Nothing is stored: Resend keeps the received email and hands out a link to
 * the file that works for an hour, so each view fetches it afresh.
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
  if (!canViewInBrowser(name)) return unavailable("QuoteLoop only opens PDFs and photos.", 415);

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

  let bytes: Buffer;
  try {
    const res = await fetchPublic(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    if (Number(res.headers.get("content-length") ?? 0) > MAX_VIEW_BYTES) return unavailable("This file is too large to open in QuoteLoop.", 413);
    bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_VIEW_BYTES) return unavailable("This file is too large to open in QuoteLoop.", 413);
  } catch (e) {
    console.error("[replies] fetching a reply's file failed:", e instanceof Error ? e.message : e);
    return unavailable("This file couldn't be opened just now. Try again in a moment.", 503);
  }

  // Whatever the name says, only a real PDF or photo is shown, typed by its content.
  const kind = sniffKind(bytes.subarray(0, 16));
  if (!kind) return unavailable("This file isn't a PDF or a photo, so QuoteLoop won't open it.", 415);
  const filename = safeFilename(name, kind.ext);
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "content-type": kind.type,
      "content-length": String(bytes.length),
      // Shown in the tab, not saved; the browser's own viewer displays it.
      "content-disposition": `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      // Nothing in the file can run as QuoteLoop. (next.config.mjs sets the same
      // policy for this path, which is what a deployed app sends.)
      "content-security-policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; object-src 'self'; frame-ancestors 'none'",
    },
  });
}

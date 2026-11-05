import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_STORED_REPLY, htmlToText, relayConfig, replySnippet } from "./reply-relay";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ReplySnippet {
  /** Who wrote it: their name, or their address. */
  from: string;
  /** The first lines of what they wrote this time (quoted history cut); empty when the text wasn't kept. */
  text: string;
  at: string;
}

/** How many missing reply texts one page load fetches, at most. */
const RECOVER_AT_ONCE = 3;

/**
 * Replies that arrived before QuoteLoop kept their text have none saved. Their
 * text is fetched once from Resend (by the email's own id) and saved; if Resend
 * no longer has it, an empty text is saved so it is never asked for again.
 * Never throws: a reply without text just shows without it.
 */
export async function recoverReplyText(
  userId: string,
  rows: { id: string; resend_email_id?: string | null; body: string | null }[]
): Promise<Record<string, string>> {
  const missing = rows.filter((r) => r.body === null && r.resend_email_id).slice(0, RECOVER_AT_ONCE);
  const relay = relayConfig();
  const db = createAdminClient();
  if (!missing.length || !relay || !db) return {};
  const found: Record<string, string> = {};
  await Promise.all(
    missing.map(async (r) => {
      let text = "";
      try {
        const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(r.resend_email_id!)}`, {
          headers: { authorization: `Bearer ${relay.apiKey}` },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const full = (await res.json()) as { text?: string | null; html?: string | null };
          text = (full.text?.trim() ? full.text : htmlToText(full.html ?? "")).slice(0, MAX_STORED_REPLY);
        } else if (res.status !== 404) {
          // Resend busy or unreachable: try again on a later visit.
          console.error(`[replies] recovering a reply's text: Resend returned ${res.status}`);
          return;
        }
      } catch (e) {
        console.error("[replies] recovering a reply's text failed:", e instanceof Error ? e.message : e);
        return;
      }
      // Only this user's reply, and only if it still has no text.
      const { error } = await db.from("customer_replies").update({ body: text }).eq("id", r.id).eq("user_id", userId).is("body", null);
      if (error) console.error("[replies] saving a recovered reply's text failed:", error.message);
      else found[r.id] = text;
    })
  );
  return found;
}

/**
 * The newest real (not automatic) reply for each of these quotes. Optional
 * everywhere it's shown, so a failed load (or a table not there yet) gives none.
 */
export async function latestReplies(supabase: SupabaseClient, userId: string, quoteIds: string[]): Promise<Record<string, ReplySnippet>> {
  if (!quoteIds.length) return {};
  const { data, error } = await supabase
    .from("customer_replies")
    .select("id, quote_id, from_name, from_email, body, resend_email_id, received_at")
    .eq("user_id", userId)
    .eq("auto_reply", false)
    .in("quote_id", quoteIds.slice(0, 200))
    .order("received_at", { ascending: false })
    .limit(400);
  if (error) {
    console.error("[replies] couldn't load reply snippets:", error.message);
    return {};
  }
  const newest: typeof data = [];
  const seen = new Set<string>();
  for (const r of data ?? []) {
    if (seen.has(r.quote_id as string)) continue;
    seen.add(r.quote_id as string);
    newest.push(r);
  }
  const recovered = await recoverReplyText(userId, newest as { id: string; resend_email_id: string | null; body: string | null }[]);
  const out: Record<string, ReplySnippet> = {};
  for (const r of newest) {
    const body = (recovered[r.id as string] ?? r.body) as string | null;
    out[r.quote_id as string] = {
      from: (r.from_name as string | null) || (r.from_email as string),
      // Their words only: never the subject line in their place.
      text: replySnippet(body),
      at: r.received_at as string,
    };
  }
  return out;
}

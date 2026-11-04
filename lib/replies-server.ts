import type { SupabaseClient } from "@supabase/supabase-js";
import { replySnippet } from "./reply-relay";

export interface ReplySnippet {
  /** Who wrote it: their name, or their address. */
  from: string;
  /** The first lines of what they wrote this time (quoted history cut). */
  text: string;
  at: string;
}

/**
 * The newest real (not automatic) reply for each of these quotes. Optional
 * everywhere it's shown, so a failed load (or a table not there yet) gives none.
 */
export async function latestReplies(supabase: SupabaseClient, userId: string, quoteIds: string[]): Promise<Record<string, ReplySnippet>> {
  if (!quoteIds.length) return {};
  const { data, error } = await supabase
    .from("customer_replies")
    .select("quote_id, from_name, from_email, body, subject, received_at")
    .eq("user_id", userId)
    .eq("auto_reply", false)
    .in("quote_id", quoteIds.slice(0, 200))
    .order("received_at", { ascending: false })
    .limit(400);
  if (error) {
    console.error("[replies] couldn't load reply snippets:", error.message);
    return {};
  }
  const out: Record<string, ReplySnippet> = {};
  for (const r of data ?? []) {
    const id = r.quote_id as string;
    if (out[id]) continue;
    out[id] = {
      from: (r.from_name as string | null) || (r.from_email as string),
      text: replySnippet(r.body as string | null) || ((r.subject as string | null) ?? ""),
      at: r.received_at as string,
    };
  }
  return out;
}

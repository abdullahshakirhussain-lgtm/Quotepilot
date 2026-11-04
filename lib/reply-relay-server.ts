import type { SupabaseClient } from "@supabase/supabase-js";
import { newReplyToken, relayConfig, replyAddress, type RelayConfig } from "./reply-relay";

/**
 * The reply address for an email about this quote, made once per quote with
 * the user's own session. Null when replies aren't relayed, or if the address
 * can't be made: the email then replies to the business email, as before, so
 * the relay can never stop an email from being sent.
 */
export async function replyToFor(
  supabase: SupabaseClient,
  userId: string,
  quoteId: string,
  businessName: string,
  config: RelayConfig | null = relayConfig()
): Promise<string | null> {
  if (!config || !quoteId) return null;
  try {
    const find = async () => {
      const { data, error } = await supabase
        .from("reply_tokens")
        .select("token")
        .eq("quote_id", quoteId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data?.token as string | undefined) ?? null;
    };
    let token = await find();
    if (!token) {
      const fresh = newReplyToken();
      const { error } = await supabase.from("reply_tokens").insert({ token: fresh, user_id: userId, quote_id: quoteId });
      // Made a moment ago by another tab: use that one.
      token = error ? await find() : fresh;
      if (error && !token) throw new Error(error.message);
    }
    return token ? replyAddress(token, config.domain, businessName) : null;
  } catch (e) {
    console.error("[replies] no reply address, replies go to the business email:", e instanceof Error ? e.message : e);
    return null;
  }
}

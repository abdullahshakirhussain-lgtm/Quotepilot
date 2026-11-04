import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Updates under the bell: things that happened while the user wasn't looking
// (a customer replied, a payment failed). Written only by the server with the
// service role; users read them, mark them read and delete them.
// ---------------------------------------------------------------------------

export type NotificationKind =
  | "customer_reply"
  | "auto_reply"
  | "forward_failed"
  | "payment_received"
  | "payment_failed"
  | "payment_reversed"
  | "subscription_canceled"
  | "subscription_expired";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  quote_id: string | null;
  title: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
}

/**
 * Records an update once per background event (dedupeKey), however often the
 * event is retried. Best effort: an update that can't be written is logged,
 * never a reason to fail the work it describes.
 */
export async function notify(
  db: SupabaseClient,
  n: { userId: string; kind: NotificationKind; title: string; body?: string | null; quoteId?: string | null; dedupeKey: string }
): Promise<void> {
  const { error } = await db.from("notifications").upsert(
    {
      user_id: n.userId,
      kind: n.kind,
      title: n.title.slice(0, 200),
      body: n.body ? n.body.slice(0, 400) : null,
      quote_id: n.quoteId ?? null,
      dedupe_key: n.dedupeKey.slice(0, 200),
    },
    { onConflict: "dedupe_key", ignoreDuplicates: true }
  );
  if (error) console.error("[updates] couldn't record an update:", error.message);
}

// ---------------------------------------------------------------------------
// Per-user send limits that two requests started at the same time can't slip
// past.
//
// Counting rows and then inserting is two round trips, so two sends started
// together could both read "24 today" and both go out. The database function
// insert_email_log_within_limits does the count and the insert inside one
// transaction, behind a per-user advisory lock, so the second one waits and
// then sees the first.
//
// If that function isn't in the database yet (schema.sql not re-run), we fall
// back to inserting first and then checking our position in the window: both
// racing requests read the same order, so the later one refuses itself and
// releases its slot. That's a narrower window than counting first, but it is
// not a transaction — see the note in the report.
// ---------------------------------------------------------------------------
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailLogInsert } from "./email-send";
import {
  EMAIL_DAILY_LIMIT,
  EMAIL_MONTHLY_LIMIT,
  EmailQuotaError,
  quotaError,
  slotWithinLimit,
} from "./email";

const DAY_MS = 86_400_000;
const MONTH_MS = 30 * DAY_MS;

interface PostgrestError {
  message: string;
  code?: string;
}

/** PostgREST can't find the function: this database hasn't been upgraded yet. */
function isMissingFunction(error: PostgrestError): boolean {
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /could not find the function|does not exist|schema cache/i.test(error.message)
  );
}

/** How many emails this user has sent (or has in flight) in each window. */
export async function countRecentEmails(
  supabase: SupabaseClient,
  userId: string
): Promise<{ day: number; month: number }> {
  const now = Date.now();
  const countSince = (ms: number) =>
    supabase
      .from("email_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["pending", "sent"])
      .gte("created_at", new Date(now - ms).toISOString());
  const [day, month] = await Promise.all([countSince(DAY_MS), countSince(MONTH_MS)]);
  const error = day.error ?? month.error;
  if (error) throw new Error(`email limit check: ${error.message}`);
  return { day: day.count ?? 0, month: month.count ?? 0 };
}

async function limitMessage(supabase: SupabaseClient, userId: string): Promise<string> {
  try {
    const message = quotaError(await countRecentEmails(supabase, userId));
    if (message) return message;
  } catch {
    /* fall through to the daily wording */
  }
  return quotaError({ day: EMAIL_DAILY_LIMIT, month: 0 })!;
}

/** Is this freshly written log inside both windows' allowances? */
async function claimsASlot(
  supabase: SupabaseClient,
  userId: string,
  logId: string
): Promise<boolean> {
  const now = Date.now();
  const window = (ms: number, limit: number) =>
    supabase
      .from("email_logs")
      .select("id")
      .eq("user_id", userId)
      .in("status", ["pending", "sent"])
      .gte("created_at", new Date(now - ms).toISOString())
      // Both racing requests must read the same order, so ties break on id.
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(limit + 1);

  const [day, month] = await Promise.all([
    window(DAY_MS, EMAIL_DAILY_LIMIT),
    window(MONTH_MS, EMAIL_MONTHLY_LIMIT),
  ]);
  const error = day.error ?? month.error;
  if (error) throw new Error(`email limit check: ${error.message}`);

  const ids = (rows: { id: string }[] | null) => (rows ?? []).map((r) => r.id);
  return (
    slotWithinLimit(ids(day.data), logId, EMAIL_DAILY_LIMIT) &&
    slotWithinLimit(ids(month.data), logId, EMAIL_MONTHLY_LIMIT)
  );
}

/** Gives a refused attempt's slot back, so a later send isn't blocked by it. */
async function releaseSlot(supabase: SupabaseClient, userId: string, logId: string) {
  await supabase
    .from("email_logs")
    .update({ status: "failed", error_message: "Refused: over the send limit." })
    .eq("id", logId)
    .eq("user_id", userId);
}

/**
 * Writes the 'pending' audit log for a send, or throws EmailQuotaError when the
 * user is already at a limit. Nothing is sent unless this succeeds.
 */
export function insertLogWithinLimits(supabase: SupabaseClient, userId: string) {
  return async (row: EmailLogInsert): Promise<string> => {
    const rpc = await supabase.rpc("insert_email_log_within_limits", {
      p_quote_id: row.quote_id,
      p_lead_id: row.lead_id,
      p_follow_up_id: row.follow_up_id,
      p_recipient_email: row.recipient_email,
      p_subject: row.subject,
      p_body: row.body,
      p_day_limit: EMAIL_DAILY_LIMIT,
      p_month_limit: EMAIL_MONTHLY_LIMIT,
    });

    if (!rpc.error) {
      if (rpc.data) return String(rpc.data);
      throw new EmailQuotaError(await limitMessage(supabase, userId));
    }
    if (!isMissingFunction(rpc.error)) {
      throw new Error(`email log: ${rpc.error.message}`);
    }

    // Older database: claim a slot by position instead.
    const { data, error } = await supabase
      .from("email_logs")
      .insert({ ...row, user_id: userId, provider: "resend" })
      .select("id")
      .single();
    if (error) throw new Error(`email log: ${error.message}`);
    const logId = String(data!.id);

    let claimed: boolean;
    try {
      claimed = await claimsASlot(supabase, userId, logId);
    } catch {
      // The check itself failed; the pre-send count already passed, so allow it.
      return logId;
    }
    if (claimed) return logId;

    await releaseSlot(supabase, userId, logId).catch(() => {});
    throw new EmailQuotaError(await limitMessage(supabase, userId));
  };
}

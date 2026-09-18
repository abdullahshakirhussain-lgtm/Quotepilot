// ---------------------------------------------------------------------------
// Per-user send limits and repeat checks that two requests started at the same
// time can't slip past, and an email log whose outcome only the send itself
// can record.
//
// Counting rows and then inserting is two round trips, so two sends started
// together could both read "24 today" and both go out. The database function
// start_email_send does the checks and the insert inside one transaction,
// behind a per-user advisory lock, so the second one waits and then sees the
// first. finish_email_send records the outcome, given the token start handed
// out.
//
// A database that hasn't had schema.sql re-run yet falls back, step by step,
// to insert_email_log_within_limits (limits only, outcome written directly),
// and before that to inserting first and then checking our position in the
// window: both racing requests read the same order, so the later one refuses
// itself and releases its slot. That last one is not a transaction.
// ---------------------------------------------------------------------------
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailLogInsert, EmailLogPatch } from "./email-send";
import {
  EMAIL_DAILY_LIMIT,
  EMAIL_MONTHLY_LIMIT,
  EmailQuotaError,
  EmailRefusedError,
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

/** Before start_email_send existed: the limits only, then the plain insert. */
async function insertWithOlderDatabase(
  supabase: SupabaseClient,
  userId: string,
  row: EmailLogInsert
): Promise<string> {
  const { quote_email: _quoteEmail, ...fields } = row;
  const rpc = await supabase.rpc("insert_email_log_within_limits", {
    p_quote_id: fields.quote_id,
    p_lead_id: fields.lead_id,
    p_follow_up_id: fields.follow_up_id,
    p_recipient_email: fields.recipient_email,
    p_subject: fields.subject,
    p_body: fields.body,
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

  // Oldest database: claim a slot by position instead.
  const { data, error } = await supabase
    .from("email_logs")
    .insert({ ...fields, user_id: userId, provider: "resend" })
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
}

/**
 * Writes the audit log for one send and later records how it went.
 *
 * `insert` writes the 'pending' log and claims a slot against the send limits
 * in one step. It throws EmailQuotaError at a limit, or EmailRefusedError when
 * the database finds a repeat of an email just sent or a reminder / draft quote
 * that already has one. Nothing is sent unless it succeeds, and because the
 * database makes these checks under one lock, two tabs pressing Send at the
 * same moment can't both get through.
 *
 * `update` records the outcome. A log written by start_email_send can only be
 * finished with the one-time token the database returned for it. The token
 * stays in this object, in server memory, and never reaches the browser.
 */
export function emailLogWriter(supabase: SupabaseClient, userId: string) {
  const tokens = new Map<string, string>();

  return {
    async insert(row: EmailLogInsert): Promise<string> {
      const rpc = await supabase.rpc("start_email_send", {
        p_quote_id: row.quote_id,
        p_lead_id: row.lead_id,
        p_follow_up_id: row.follow_up_id,
        p_recipient_email: row.recipient_email,
        p_subject: row.subject,
        p_body: row.body,
        p_day_limit: EMAIL_DAILY_LIMIT,
        p_month_limit: EMAIL_MONTHLY_LIMIT,
        p_repeat_minutes: REPEAT_WINDOW_MINUTES,
        p_quote_email: Boolean(row.quote_email),
      });

      if (rpc.error) {
        if (isMissingFunction(rpc.error)) return insertWithOlderDatabase(supabase, userId, row);
        throw new Error(`email log: ${rpc.error.message}`);
      }

      const result = (rpc.data ?? {}) as { outcome?: string; id?: string; token?: string };
      if (result.outcome === "ok" && result.id && result.token) {
        tokens.set(String(result.id), String(result.token));
        return String(result.id);
      }
      if (result.outcome === "limit") throw new EmailQuotaError(await limitMessage(supabase, userId));
      if (result.outcome === "repeat" || result.outcome === "already_sent") {
        throw new EmailRefusedError(result.outcome);
      }
      throw new Error(`email log: unexpected answer (${String(result.outcome)})`);
    },

    async update(id: string, patch: EmailLogPatch): Promise<void> {
      const token = tokens.get(id);
      if (!token) {
        // Written by an older database function: the direct route still applies.
        const { error } = await supabase
          .from("email_logs")
          .update(patch)
          .eq("id", id)
          .eq("user_id", userId);
        if (error) throw new Error(`email log update: ${error.message}`);
        return;
      }

      const rpc = await supabase.rpc("finish_email_send", {
        p_log_id: id,
        p_token: token,
        p_status: patch.status ?? "pending",
        p_provider_message_id: patch.provider_message_id ?? null,
        p_error_message: patch.error_message ?? null,
      });
      if (rpc.error) throw new Error(`email log update: ${rpc.error.message}`);
      if (rpc.data !== true) {
        // Only this send holds the token, so this shouldn't happen. Keep a trace
        // for whoever runs QuoteLoop; the caller reports it as a warning.
        console.error(`[email] log ${id} was no longer pending when its outcome was recorded`);
        throw new Error("email log update: the log was no longer pending");
      }
    },
  };
}

/** How long an identical email to the same person is treated as a repeat. */
export const REPEAT_WINDOW_MINUTES = 10;

/**
 * True when the user sent (or is still sending) this exact email to this
 * recipient within the last few minutes — a second tab, a repeated submit.
 * Failed attempts don't count: they never reached the customer.
 *
 * An early, friendly check before anything is saved. The database repeats it
 * inside start_email_send, where two sends at once can't both pass.
 */
export async function sentRecently(
  supabase: SupabaseClient,
  userId: string,
  email: { to: string; subject: string; text: string }
): Promise<boolean> {
  const since = new Date(Date.now() - REPEAT_WINDOW_MINUTES * 60_000).toISOString();
  const { data, error } = await supabase
    .from("email_logs")
    .select("body")
    .eq("user_id", userId)
    .eq("recipient_email", email.to)
    .eq("subject", email.subject)
    .in("status", ["pending", "sent"])
    .gte("created_at", since)
    .limit(100);
  if (error) throw new Error(`recent email check: ${error.message}`);
  // The text is compared here, not in the query: filters travel in the URL,
  // and a long (or non-Latin) email would make it too long for the API.
  return (data ?? []).some((row) => row.body === email.text);
}

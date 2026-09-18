// ---------------------------------------------------------------------------
// Server-only email helpers: config, validation, composition and the Resend
// call (plain fetch, no SDK). Keys come from env and never reach the browser.
// Manual 1-to-1 follow-ups only — nothing here schedules or bulk-sends.
// ---------------------------------------------------------------------------

import { cleanPasted, isValidEmail } from "./email-address";

/** Per user, rolling 24 hours. */
export const EMAIL_DAILY_LIMIT = 25;
/** Per user, rolling 30 days. */
export const EMAIL_MONTHLY_LIMIT = 100;
export const MAX_SUBJECT_LENGTH = 200;
export const MAX_BODY_LENGTH = 10_000;

const RESEND_URL = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 15_000;

export interface EmailConfig {
  apiKey: string;
  /** e.g. "QuoteLoop <followups@your-verified-domain.com>" */
  from: string;
}

/**
 * Null when email sending isn't configured (the UI then offers copy only).
 * Replies always go to the business email in Settings; there is no fallback.
 */
export function emailConfig(env: Record<string, string | undefined> = process.env): EmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

export { cleanPasted, isValidEmail } from "./email-address";

/** Shown when email sending is attempted without a business email to reply to. */
export const NEEDS_BUSINESS_EMAIL =
  "Add a working business email in Settings first, so your customer's replies come to you. Nothing was sent.";

/** The same mailbox, ignoring case, spaces and invisible pasted characters. */
export function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  return cleanPasted(a).toLowerCase() === cleanPasted(b).toLowerCase();
}

export function defaultSubject(quoteTitle: string): string {
  return `Following up on your quote: ${quoteTitle}`.slice(0, MAX_SUBJECT_LENGTH);
}

/** One line, trimmed and capped — CR/LF removed so it can't inject headers. */
export function cleanSubject(
  raw: string | null | undefined,
  quoteTitle: string,
  /** Used when the subject is left blank. Defaults to the follow-up subject. */
  fallback: string = defaultSubject(quoteTitle)
): string {
  const s = (raw ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, MAX_SUBJECT_LENGTH);
  return s || fallback.slice(0, MAX_SUBJECT_LENGTH);
}

/** `"Business via QuoteLoop" <address>` using the verified EMAIL_FROM address. */
export function formatFrom(configFrom: string, businessName: string): string {
  const address = (/<([^>]+)>/.exec(configFrom)?.[1] ?? configFrom).trim();
  const name = businessName.replace(/[\r\n"<>\\]/g, "").trim().slice(0, 80);
  return name ? `"${name} via QuoteLoop" <${address}>` : `QuoteLoop <${address}>`;
}

/** The exact plain-text body sent: the user's final message plus a 1-to-1 footer. */
export function composeEmailText(message: string, businessName: string): string {
  const name = businessName.trim() || "this business";
  return (
    `${message.trim()}\n\n` +
    `—\nYou're receiving this because you requested a quote from ${name}. ` +
    `Just reply to this email to respond.`
  );
}

/**
 * Refusal because the user is already at a send limit. Carries a plain marker
 * rather than relying on `instanceof`, which is unreliable across bundles.
 */
export class EmailQuotaError extends Error {
  readonly quota = true;
  constructor(message: string) {
    super(message);
    this.name = "EmailQuotaError";
  }
}

export function isEmailQuotaError(e: unknown): e is EmailQuotaError {
  return typeof e === "object" && e !== null && (e as { quota?: unknown }).quota === true;
}

/**
 * Refusal found by the database while starting a send, inside the same lock
 * as the limits: "repeat" (this exact email went to this person moments ago)
 * or "already_sent" (this reminder, or this draft quote, already has an email).
 * Nothing was written or sent.
 */
export class EmailRefusedError extends Error {
  readonly refused = true;
  constructor(readonly reason: "repeat" | "already_sent") {
    super(`send refused: ${reason}`);
    this.name = "EmailRefusedError";
  }
}

export function isEmailRefusedError(e: unknown): e is EmailRefusedError {
  return typeof e === "object" && e !== null && (e as { refused?: unknown }).refused === true;
}

/**
 * Whether a log that was just written is inside the allowance, given the ids of
 * every counted log in that window, oldest first. Used when the database can't
 * do the count and the insert together: both racing requests read the same
 * order, so only the earlier one finds itself inside the limit.
 */
export function slotWithinLimit(orderedIds: string[], logId: string, limit: number): boolean {
  const position = orderedIds.indexOf(logId);
  return position >= 0 && position < limit;
}

/** Friendly limit message, or null when the user may send. */
export function quotaError(counts: { day: number; month: number }): string | null {
  if (counts.day >= EMAIL_DAILY_LIMIT) {
    return `You've reached the limit of ${EMAIL_DAILY_LIMIT} emails from QuoteLoop in 24 hours. You can still copy the message and send it yourself.`;
  }
  if (counts.month >= EMAIL_MONTHLY_LIMIT) {
    return `You've reached the limit of ${EMAIL_MONTHLY_LIMIT} emails in 30 days. You can still copy the message and send it yourself.`;
  }
  return null;
}

export type SendResult =
  | { ok: true; id: string | null }
  /**
   * `uncertain`: the provider never answered clearly (timeout, dropped
   * connection, 5xx), so the email may still have been delivered.
   */
  | { ok: false; reason: string; uncertain?: boolean };

export interface OutgoingEmail {
  from: string;
  to: string;
  subject: string;
  text: string;
  replyTo: string | null;
}

/**
 * Sends one email through Resend. Never throws: failures come back as a short,
 * user-safe reason (full provider details are logged server-side only).
 * `fetchImpl` is injectable so the send paths can be tested without a network.
 */
export async function sendViaResend(
  config: EmailConfig,
  email: OutgoingEmail,
  fetchImpl: typeof fetch = fetch
): Promise<SendResult> {
  try {
    const res = await fetchImpl(RESEND_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: email.from,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[email] provider returned ${res.status}:`, detail.slice(0, 300));
      return { ok: false, reason: describeStatus(res.status), uncertain: res.status >= 500 };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: typeof data.id === "string" ? data.id : null };
  } catch (err) {
    console.error("[email] send failed:", err);
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return {
      ok: false,
      // The request may have reached the provider before the connection broke.
      uncertain: true,
      reason: timedOut ? "the email service timed out" : "the email service couldn't be reached",
    };
  }
}

/**
 * What went wrong, in words a business owner can act on. Account and domain
 * problems are QuoteLoop's to fix, so they say so rather than naming settings
 * the user can't see.
 */
function describeStatus(status: number): string {
  if (status === 401 || status === 403) {
    return "QuoteLoop's email sending isn't working right now because of a setup problem on our side, not anything you did. Please try again later";
  }
  if (status === 422) {
    return "the email service couldn't accept this email. Check the customer's email address; if it's right, the problem is on QuoteLoop's side, so please try again later";
  }
  if (status === 429) return "the email service is busy. Please wait a minute and try again";
  if (status >= 500) return "the email service had a problem";
  return `the email service couldn't send it (error ${status}). Please try again later`;
}

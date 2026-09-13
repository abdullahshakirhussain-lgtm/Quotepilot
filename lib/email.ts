// ---------------------------------------------------------------------------
// Server-only email helpers: config, validation, composition and the Resend
// call (plain fetch, no SDK). Keys come from env and never reach the browser.
// Manual 1-to-1 follow-ups only — nothing here schedules or bulk-sends.
// ---------------------------------------------------------------------------

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
  /** e.g. "QuotePilot <followups@your-verified-domain.com>" */
  from: string;
  replyToFallback: string | null;
}

/** Null when email sending isn't configured (the UI then offers copy only). */
export function emailConfig(env: Record<string, string | undefined> = process.env): EmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from, replyToFallback: env.EMAIL_REPLY_TO?.trim() || null };
}

const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;

export function isValidEmail(value: string | null | undefined): value is string {
  return Boolean(value) && value!.length <= 254 && EMAIL_PATTERN.test(value!.trim());
}

export function defaultSubject(quoteTitle: string): string {
  return `Following up on your quote: ${quoteTitle}`.slice(0, MAX_SUBJECT_LENGTH);
}

/** One line, trimmed and capped — CR/LF removed so it can't inject headers. */
export function cleanSubject(raw: string | null | undefined, quoteTitle: string): string {
  const s = (raw ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, MAX_SUBJECT_LENGTH);
  return s || defaultSubject(quoteTitle);
}

/** `"Business via QuotePilot" <address>` using the verified EMAIL_FROM address. */
export function formatFrom(configFrom: string, businessName: string): string {
  const address = (/<([^>]+)>/.exec(configFrom)?.[1] ?? configFrom).trim();
  const name = businessName.replace(/[\r\n"<>\\]/g, "").trim().slice(0, 80);
  return name ? `"${name} via QuotePilot" <${address}>` : `QuotePilot <${address}>`;
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

/** Friendly limit message, or null when the user may send. */
export function quotaError(counts: { day: number; month: number }): string | null {
  if (counts.day >= EMAIL_DAILY_LIMIT) {
    return `You've reached the limit of ${EMAIL_DAILY_LIMIT} emails from QuotePilot in 24 hours. You can still copy the message and send it yourself.`;
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

function describeStatus(status: number): string {
  if (status === 401 || status === 403) return "the email service rejected the sender configuration";
  if (status === 422) return "the email service rejected this message (is the sending domain verified?)";
  if (status === 429) return "the email service is busy — try again in a minute";
  return `the email service returned an error (${status})`;
}

// ---------------------------------------------------------------------------
// Customer replies: every email sent from QuoteLoop carries a reply address
// unique to its quote (r-<token>@<reply domain>). Resend receives the reply
// and calls /api/email/inbound, which records it, pauses the quote's
// reminders and forwards the reply to the business email.
//
// Dormant until INBOUND_REPLY_DOMAIN and RESEND_WEBHOOK_SECRET are set: until
// then replies go straight to the business email, as before.
// Pure helpers only (no database, no network) so they can be tested directly.
// ---------------------------------------------------------------------------
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface RelayConfig {
  /** e.g. "mail.quoteloop.site": Resend receives mail for this domain. */
  domain: string;
  /** Resend's signing secret for the inbound webhook ("whsec_..."). */
  webhookSecret: string;
  /** For reading received emails; the sending key unless a separate one is set. */
  apiKey: string;
}

const DOMAIN = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export function relayConfig(env: Record<string, string | undefined> = process.env): RelayConfig | null {
  const domain = env.INBOUND_REPLY_DOMAIN?.trim().toLowerCase() ?? "";
  const webhookSecret = env.RESEND_WEBHOOK_SECRET?.trim() ?? "";
  const apiKey = (env.RESEND_RECEIVING_API_KEY || env.RESEND_API_KEY || "").trim();
  if (!DOMAIN.test(domain) || !webhookSecret.startsWith("whsec_") || !apiKey) return null;
  return { domain, webhookSecret, apiKey };
}

// --- Reply addresses --------------------------------------------------------

const TOKEN_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
export const TOKEN_PATTERN = /^[a-z0-9]{24}$/;

/** 24 random characters from 36: about 124 bits, not guessable. */
export function newReplyToken(random: (n: number) => Buffer = randomBytes): string {
  let token = "";
  while (token.length < 24) {
    for (const byte of random(32)) {
      // 252 = 7 * 36: skipping 252..255 keeps every character equally likely.
      if (byte < 252 && token.length < 24) token += TOKEN_ALPHABET[byte % 36];
    }
  }
  return token;
}

/** `"Northside Home Services" <r-token@domain>`: replies show the business's name. */
export function replyAddress(token: string, domain: string, businessName: string): string {
  const name = businessName.replace(/[\r\n"<>\\]/g, "").trim().slice(0, 80);
  const address = `r-${token}@${domain}`;
  return name ? `"${name}" <${address}>` : address;
}

/** The token in an address like "r-abc...@domain" (any case, display name allowed), or null. */
export function tokenFromAddress(raw: string, domain: string): string | null {
  const address = (/<([^>]+)>/.exec(raw)?.[1] ?? raw).trim().toLowerCase();
  const at = address.lastIndexOf("@");
  if (at < 0 || address.slice(at + 1) !== domain.toLowerCase()) return null;
  const local = address.slice(0, at);
  if (!local.startsWith("r-")) return null;
  const token = local.slice(2);
  return TOKEN_PATTERN.test(token) ? token : null;
}

// --- Webhook signatures (Svix, as used by Resend) ---------------------------

/** How far a webhook's timestamp may be from now, either way. */
export const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

/**
 * Checks a Resend (Svix) webhook signature: HMAC-SHA256 over
 * "<svix-id>.<svix-timestamp>.<raw body>" with the base64 part of the
 * "whsec_" secret as the key, compared with each "v1,<base64>" in
 * svix-signature. Also refuses timestamps more than 5 minutes off, so an
 * old request can't be replayed.
 */
export function verifyWebhook(
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  rawBody: string,
  secret: string,
  nowMs: number = Date.now()
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature || !secret.startsWith("whsec_")) return false;
  if (!/^\d{1,12}$/.test(timestamp)) return false;
  if (Math.abs(nowMs / 1000 - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) return false;
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  if (!key.length) return false;
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest();
  return signature.split(" ").some((part) => {
    const [version, value] = part.split(",", 2);
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

// --- Reading a received email -----------------------------------------------

/** Out-of-office and other automatic replies, by their standard headers. */
export function isAutoReply(headers: Record<string, unknown> | null | undefined, subject?: string | null): boolean {
  const h: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers ?? {})) h[k.toLowerCase()] = String(Array.isArray(v) ? v[0] : (v ?? "")).toLowerCase();
  if (h["auto-submitted"] && h["auto-submitted"] !== "no") return true;
  if (/^(bulk|junk|list|auto_reply)$/.test(h["precedence"] ?? "")) return true;
  if ("x-autoreply" in h || "x-autorespond" in h || "x-auto-response-suppress" in h) return true;
  return /^(auto(matic)? reply|out of (the )?office|autoreply)\b/i.test((subject ?? "").trim());
}

/** "Hannah Brooks <hannah@x.com>" -> name and address. */
export function parseMailbox(raw: string | null | undefined): { name: string | null; email: string } {
  const value = (raw ?? "").trim();
  const angle = /^(.*)<([^>]+)>\s*$/.exec(value);
  if (!angle) return { name: null, email: value.toLowerCase() };
  const name = angle[1].trim().replace(/^"|"$/g, "").trim();
  return { name: name || null, email: angle[2].trim().toLowerCase() };
}

/** Plain text from an HTML-only email: good enough to read a reply. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Largest reply text forwarded; longer ones are cut with a note. */
export const MAX_FORWARD_TEXT = 50_000;

/** The forwarded email's text: who replied, about which quote, then their words. */
export function forwardText(input: {
  customerName: string | null;
  customerEmail: string;
  quoteTitle: string | null;
  text: string;
  skippedAttachments: string[];
  /** What happened to the quote's reminders. */
  reminders: "paused" | "unchanged" | "auto_reply";
}): string {
  const who = input.customerName ? `${input.customerName} (${input.customerEmail})` : input.customerEmail;
  const about = input.quoteTitle ? ` about your quote "${input.quoteTitle}"` : "";
  const lines = [
    input.reminders === "auto_reply"
      ? `${who} sent an automatic reply${about}. Your reminders for this quote carry on as planned.`
      : input.reminders === "paused"
        ? `${who} replied${about}. QuoteLoop has paused the reminders for this quote.`
        : `${who} replied${about}.`,
    "Reply to this email to answer them directly.",
  ];
  if (input.skippedAttachments.length) {
    lines.push(
      `Too large to forward: ${input.skippedAttachments.join(", ")}. Ask ${input.customerName ?? "them"} to send ${input.skippedAttachments.length === 1 ? "it" : "them"} to you directly.`
    );
  }
  let text = input.text.trim() || "(The reply had no text.)";
  if (text.length > MAX_FORWARD_TEXT) text = `${text.slice(0, MAX_FORWARD_TEXT)}\n\n(The rest of this reply was too long to forward.)`;
  return `${lines.join("\n")}\n\n-----\n\n${text}`;
}

/** Forwarded subject: the customer's own, or one naming the quote. */
export function forwardSubject(subject: string | null | undefined, quoteTitle: string | null): string {
  const s = (subject ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
  return (s || (quoteTitle ? `Reply about ${quoteTitle}` : "Customer reply")).slice(0, 200);
}

/** Attachments forwarded per reply, in total (Resend allows 40MB after base64). */
export const MAX_FORWARD_ATTACHMENT_BYTES = 20 * 1024 * 1024;
/** Replies handled per reply address per day: a leaked address can't flood an inbox or the quota. */
export const MAX_REPLIES_PER_TOKEN_PER_DAY = 20;

/**
 * Headers that make an answer thread with the customer's email in their inbox.
 * The Message-ID comes from the stored reply (never the browser) and is
 * cleaned so it can't add a header of its own.
 */
export function threadHeaders(messageId: string | null | undefined): Record<string, string> {
  const id = (messageId ?? "").replace(/[\r\n\s]+/g, "").slice(0, 500);
  if (!id) return {};
  const wrapped = id.startsWith("<") ? id : `<${id}>`;
  return { "In-Reply-To": wrapped, References: wrapped };
}

export { MAX_STORED_REPLY, newPartOfReply, replySnippet } from "./reply-text";

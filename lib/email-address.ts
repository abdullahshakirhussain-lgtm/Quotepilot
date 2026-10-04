// Email address checks shared by the browser and the server. Kept apart from
// lib/email.ts, which holds server-only sending code.

const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;

// Invisible characters that ride along when an address is pasted from a chat
// app or a web page: zero-width spaces and joiners, the byte-order mark, soft
// hyphens, and the left-to-right / right-to-left marks and isolates that chat
// apps (WhatsApp, for one) wrap around addresses and numbers. They are
// invisible, so the address "looks right" but fails.
const INVISIBLE = /[­​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

/** Removes invisible characters and surrounding spaces from pasted text. */
export function cleanPasted(value: string | null | undefined): string {
  return (value ?? "").replace(INVISIBLE, "").trim();
}

export function isValidEmail(value: string | null | undefined): value is string {
  return Boolean(value) && value!.length <= 254 && EMAIL_PATTERN.test(value!.trim());
}

/**
 * An address on a domain reserved for examples and tests (RFC 2606 and 6761):
 * no mail to it can ever arrive. QuoteLoop's demo customers use these, which
 * is how sample records are recognised, and why nothing is ever sent to them.
 */
export function isSampleAddress(value: string | null | undefined): boolean {
  const domain = (value ?? "").trim().toLowerCase().split("@")[1] ?? "";
  if (!domain) return false;
  return (
    /^example\.(?:com|net|org)$/.test(domain) ||
    /(?:^|\.)(?:example|test|invalid|localhost)$/.test(domain)
  );
}

export const SAMPLE_RECIPIENT_ERROR =
  "This is a sample customer from the demo data, so QuoteLoop won't email them. Nothing was sent. Copy the message to try it out instead.";

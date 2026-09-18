// ---------------------------------------------------------------------------
// The two ways a quote enters QuoteLoop, with every dependency injected so both
// paths can be tested without a database or an email provider:
//
//   A. "Send a quote with QuoteLoop" - save the quote as a draft, email it, and
//      only once the provider accepts it mark it sent and schedule follow-ups.
//      If the email fails, nothing is marked as sent.
//   B. "Track a quote already sent" - save it as sent and schedule follow-ups.
//      Never sends an email.
// ---------------------------------------------------------------------------
import { CURRENCIES } from "./constants";
import { defaultQuoteSubject } from "./quote-email";
import {
  cleanSubject,
  composeEmailText,
  formatFrom,
  isEmailQuotaError,
  isEmailRefusedError,
  isValidEmail,
  MAX_BODY_LENGTH,
  NEEDS_BUSINESS_EMAIL,
  quotaError,
  sameAddress,
  type EmailConfig,
  type OutgoingEmail,
  type SendResult,
} from "./email";
import { formatCurrency, formatDate } from "./utils";

export { NEEDS_BUSINESS_EMAIL };

export interface QuoteFields {
  customerMode: "new" | "existing";
  leadId?: string | null;
  customerName?: string | null;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  title: string;
  amount: string | number;
  currency: string;
  /** The date the quote went out. Flow A always uses the server's today. */
  sentDate: string;
  validUntil?: string | null;
  description?: string | null;
  notes?: string | null;
  /** Flow B only: "WhatsApp", "Phone", ... stored as its own quote field. */
  sentMethod?: string | null;
  /** Flow A only: the email the user reviewed. */
  subject?: string | null;
  message?: string | null;
  /**
   * Flow A only: the address the preview showed. Never used as the recipient;
   * if the saved address no longer matches it, nothing is sent.
   */
  expectedTo?: string | null;
  /** Flow B only: the user saw the "looks like a quote you already added" warning and continued. */
  allowDuplicate?: boolean;
}

export interface ScheduledFollowUp {
  follow_up_number: number;
  due_date: string;
}

export interface CustomerRecord {
  id: string;
  customer_name: string;
  email: string | null;
}

export interface NewQuoteRow {
  lead_id: string;
  title: string;
  description: string | null;
  amount: number;
  currency: string;
  quote_date: string;
  valid_until: string | null;
  notes: string | null;
  /** Never mixed into `notes`: the user's notes stay the user's own words. */
  sent_method: string | null;
  status: "draft" | "sent";
}

export type QuoteFlowOutcome =
  | {
      ok: false;
      error: string;
      /** The provider never answered clearly: the email may still go out. */
      unconfirmed?: boolean;
      /** Sending again must not be offered (it went out, or may have). */
      locked?: boolean;
      /** The quote was saved (as a draft) even though the email wasn't sent. */
      quoteSaved?: boolean;
      /** That saved draft, so a retry sends it instead of creating another. */
      quoteId?: string;
      /** Flow B: the same quote seems to be saved already. Nothing was saved; the user may continue. */
      duplicate?: boolean;
      /** The customer's saved address differs from the one previewed. Nothing was sent or saved. */
      recipientChanged?: string;
    }
  | {
      ok: true;
      quoteId: string;
      customerName: string;
      /** Set when the quote was emailed from QuoteLoop. */
      recipient?: string;
      schedule: ScheduledFollowUp[];
      /** Future follow-ups can be emailed rather than copied. */
      hasCustomerEmail: boolean;
      /** A reminder is already due or overdue — usually an older sent date. */
      followUpDueNow: boolean;
      warning?: string;
    };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Longest text QuoteLoop keeps for each field (longer input is refused, never cut). */
export const LIMITS = {
  customerName: 120,
  companyName: 120,
  phone: 40,
  title: 200,
  description: 5000,
  notes: 5000,
} as const;

/** The largest amount the database column can hold. */
export const MAX_AMOUNT = 999_999_999_999.99;

/** Earliest believable sent date: catches two-digit-year typos such as 0026. */
export const EARLIEST_SENT_DATE = "2000-01-01";

/** A YYYY-MM-DD string that is a real calendar date (not 2026-02-30). */
export function isRealDate(value: string | null | undefined): boolean {
  if (!value || !DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Plain-English "too long" message for a field, or null when it fits. */
function tooLong(value: string | null | undefined, max: number, label: string): string | null {
  return (value ?? "").trim().length > max
    ? `${label} is too long. Keep it under ${max.toLocaleString("en-US")} characters.`
    : null;
}

/** A positive money amount, or null when it isn't one. */
export function parseAmount(value: string | number | null | undefined): number | null {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[, ]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Thrown by markSent: "status" when the quote couldn't be marked as sent (it is
 * still a draft), "schedule" when it was marked sent but its reminders weren't.
 */
export class MarkSentError extends Error {
  constructor(
    readonly stage: "status" | "schedule",
    cause: unknown
  ) {
    super(`marking the quote sent failed at ${stage}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "MarkSentError";
  }
}

function markSentStage(e: unknown): "status" | "schedule" {
  return (e as { stage?: string } | null)?.stage === "schedule" ? "schedule" : "status";
}

/** True when any scheduled reminder has already come due. */
export function scheduleNeedsAttention(schedule: ScheduledFollowUp[], today: string): boolean {
  return schedule.some((f) => f.due_date.slice(0, 10) <= today);
}

/** Plain-English check of what the user typed. Returns the first problem found. */
export function validateQuote(flow: "send" | "track", f: QuoteFields, today: string): string | null {
  if (f.customerMode === "existing") {
    if (!f.leadId) return "Choose which customer this quote is for.";
  } else if (!f.customerName?.trim()) {
    return "Enter the customer's name.";
  }

  // A typed address. For a saved customer it is only needed when they have
  // none yet; whether the saved customer can be emailed is checked on sending.
  const email = f.email?.trim();
  if (flow === "send") {
    if (!email && f.customerMode !== "existing") {
      return "Enter the customer's email address so QuoteLoop can send the quote.";
    }
    if (email && !isValidEmail(email)) return "That email address doesn't look right. Check it and try again.";
  } else if (email && !isValidEmail(email)) {
    return "That email address doesn't look right. Leave it empty if you don't have one.";
  }

  if (!f.title?.trim()) return "Add a short title for the quote, like “Service 3 AC units”.";
  const amount = parseAmount(f.amount);
  if (amount === null) return "Enter the quote amount as a number greater than zero.";
  if (amount > MAX_AMOUNT) return "That amount is too large. Check the number and try again.";
  if (!(CURRENCIES as readonly string[]).includes(String(f.currency ?? "").toUpperCase())) {
    return "Choose a currency.";
  }

  const long =
    tooLong(f.customerName, LIMITS.customerName, "The customer's name") ??
    tooLong(f.companyName, LIMITS.companyName, "The company name") ??
    tooLong(f.phone, LIMITS.phone, "The phone number") ??
    tooLong(f.title, LIMITS.title, "The quote title") ??
    tooLong(f.description, LIMITS.description, "The description") ??
    tooLong(f.notes, LIMITS.notes, "The notes");
  if (long) return long;

  if (!f.sentDate || !DATE.test(f.sentDate)) {
    return flow === "track" ? "Enter the date you sent this quote." : "The quote date isn't valid.";
  }
  if (!isRealDate(f.sentDate)) return "That sent date isn't a real date. Check it and try again.";
  if (flow === "track" && f.sentDate > today) return "The sent date can't be in the future.";
  if (flow === "track" && f.sentDate < EARLIEST_SENT_DATE) {
    return "That sent date looks too far in the past. Check the year.";
  }

  if (f.validUntil) {
    if (!isRealDate(f.validUntil)) return "The valid-until date isn't a real date. Check it and try again.";
    if (f.validUntil < f.sentDate) {
      return flow === "track"
        ? "The valid-until date can't be before the sent date."
        : "The valid-until date can't be before today.";
    }
  }

  if (flow === "send") {
    const message = (f.message ?? "").trim();
    if (!message) return "Write the quote email before sending it.";
    if (message.length > MAX_BODY_LENGTH) {
      return `This email is too long to send. Keep it under ${MAX_BODY_LENGTH.toLocaleString("en-US")} characters.`;
    }
  }
  return null;
}

export interface TrackQuoteDeps {
  /** Returns the caller's own customer, creating or completing it as needed. */
  resolveCustomer(f: QuoteFields): Promise<CustomerRecord>;
  createQuote(row: NewQuoteRow): Promise<string>;
  /**
   * Marks the quote sent, schedules follow-ups from `scheduleFrom` (the day it
   * actually went out) and refreshes the counters.
   */
  markSent(quoteId: string, leadId: string, scheduleFrom: string): Promise<void>;
  getSchedule(quoteId: string): Promise<ScheduledFollowUp[]>;
  /**
   * An already saved quote with the same customer, title, amount and sent date,
   * if there is one. Looks only; never creates a customer.
   */
  findExistingQuote?(f: QuoteFields): Promise<SimilarQuote | null>;
  /**
   * Run right after this quote is saved: the same quote saved moments earlier
   * by another request (a second tab submitting at the same instant, which the
   * check above can't catch). Returns it only when this copy is the later one.
   */
  findEarlierTwin?(quoteId: string, f: QuoteFields, customer: CustomerRecord): Promise<SimilarQuote | null>;
  /** Removes a quote this request has just saved. False if it couldn't. */
  discardQuote?(quoteId: string): Promise<boolean>;
}

/** A saved quote that looks like the one being added. */
export interface SimilarQuote {
  title: string;
  customerName: string;
  sentDate: string;
}

function duplicateMessage(existing: SimilarQuote, f: QuoteFields): string {
  return `This looks like a quote you already added: “${existing.title}” for ${existing.customerName}, ${formatCurrency(
    parseAmount(f.amount)!,
    String(f.currency).toUpperCase()
  )}, sent ${formatDate(existing.sentDate)}. Add it again only if it's a separate quote.`;
}

export interface SendQuoteDeps extends TrackQuoteDeps {
  config: EmailConfig | null;
  getBusiness(): Promise<{ business_name: string; email: string | null } | null>;
  countRecentEmails(): Promise<{ day: number; month: number }>;
  /**
   * True when this exact email (same recipient, subject and text) was sent or
   * attempted in the last few minutes, e.g. from a second browser tab.
   */
  sentRecently(email: { to: string; subject: string; text: string }): Promise<boolean>;
  /**
   * Writes the 'pending' audit log AND claims a slot against the send limits,
   * throwing an EmailQuotaError when the user is already at one, or an
   * EmailRefusedError for a repeat / a draft that already has a quote email.
   * Nothing is sent unless this succeeds, so two simultaneous sends can't both
   * pass.
   */
  insertLog(row: {
    quote_id: string;
    lead_id: string;
    follow_up_id: null;
    recipient_email: string;
    subject: string;
    body: string;
    status: "pending";
    quote_email: true;
  }): Promise<string>;
  /**
   * Deletes the draft this attempt created when the send was refused as a
   * repeat, so a second tab doesn't leave a duplicate quote. Omitted when the
   * draft existed before (sending a saved draft). Returns false if it stayed.
   */
  discardDraft?(quoteId: string): Promise<boolean>;
  updateLog(
    id: string,
    patch: {
      status?: "sent" | "failed";
      provider_message_id?: string | null;
      sent_at?: string;
      error_message?: string;
    }
  ): Promise<void>;
  send(email: OutgoingEmail): Promise<SendResult>;
  now(): Date;
}

function quoteRow(f: QuoteFields, leadId: string, status: "draft" | "sent"): NewQuoteRow {
  return {
    lead_id: leadId,
    title: f.title.trim(),
    description: f.description?.trim() || null,
    amount: parseAmount(f.amount)!,
    currency: String(f.currency).toUpperCase(),
    quote_date: f.sentDate,
    valid_until: f.validUntil?.trim() || null,
    notes: f.notes?.trim() || null,
    sent_method: f.sentMethod?.trim() || null,
    status,
  };
}

/** Flow B - the quote already went out; QuoteLoop only tracks the follow-ups. */
export async function trackQuoteCore(
  deps: TrackQuoteDeps,
  f: QuoteFields,
  today: string
): Promise<QuoteFlowOutcome> {
  const problem = validateQuote("track", f, today);
  if (problem) return { ok: false, error: problem };

  // The same quote added twice (a second tab, Back and submit again) is usually
  // a mistake, but not always, so warn and let the user decide.
  if (!f.allowDuplicate && deps.findExistingQuote) {
    const existing = await deps.findExistingQuote(f);
    if (existing) return { ok: false, duplicate: true, error: duplicateMessage(existing, f) };
  }

  const customer = await deps.resolveCustomer(f);
  const quoteId = await deps.createQuote(quoteRow(f, customer.id, "sent"));

  // Two tabs submitting the same quote at the same instant both pass the check
  // above. The copy saved first is kept; this one steps aside before any
  // reminders are scheduled for it. Any doubt keeps it: a possible duplicate
  // is better than a lost quote.
  if (!f.allowDuplicate && deps.findEarlierTwin && deps.discardQuote) {
    const twin = await deps.findEarlierTwin(quoteId, f, customer).catch(() => null);
    if (twin && (await deps.discardQuote(quoteId).catch(() => false))) {
      return { ok: false, duplicate: true, error: duplicateMessage(twin, f) };
    }
  }

  const warnings: string[] = [];
  try {
    // Reminders count from the day the quote actually went out, so a quote sent
    // ten days ago arrives with its early follow-ups already overdue.
    await deps.markSent(quoteId, customer.id, f.sentDate);
  } catch {
    warnings.push("The quote was saved, but its follow-up reminders couldn't be scheduled just now.");
  }

  let schedule: ScheduledFollowUp[] = [];
  try {
    schedule = await deps.getSchedule(quoteId);
  } catch {
    /* the confirmation simply shows no dates */
  }

  return {
    ok: true,
    quoteId,
    customerName: customer.customer_name,
    schedule,
    hasCustomerEmail: isValidEmail(customer.email),
    followUpDueNow: scheduleNeedsAttention(schedule, today),
    warning: warnings[0],
  };
}

/** Flow A - QuoteLoop emails the quote, and only then marks it sent. */
export async function sendQuoteCore(
  deps: SendQuoteDeps,
  f: QuoteFields,
  today: string
): Promise<QuoteFlowOutcome> {
  const problem = validateQuote("send", f, today);
  if (problem) return { ok: false, error: problem };

  if (!deps.config) {
    return {
      ok: false,
      error:
        "Email sending isn't set up for this workspace yet, so QuoteLoop can't send the quote. Choose “Track a quote already sent” instead.",
    };
  }

  // Replies go to the business. Without a real address they would bounce or
  // land somewhere the business never sees, so don't send at all.
  const business = await deps.getBusiness();
  const replyTo = business?.email?.trim() ?? "";
  if (!isValidEmail(replyTo)) return { ok: false, error: NEEDS_BUSINESS_EMAIL };

  const limit = quotaError(await deps.countRecentEmails());
  if (limit) return { ok: false, error: limit };

  const customer = await deps.resolveCustomer(f);
  // The recipient always comes from the saved customer, never from the browser.
  const to = customer.email?.trim() ?? "";
  if (!isValidEmail(to)) {
    return {
      ok: false,
      error: "This customer doesn't have a valid email address saved, so the quote can't be sent. Add their email address, then try again.",
    };
  }
  // The preview showed one address; the customer's saved one is now different
  // (changed in another tab). Only refuse — never send to the browser's copy.
  if (f.expectedTo?.trim() && !sameAddress(f.expectedTo, to)) {
    return {
      ok: false,
      recipientChanged: to,
      error: `This customer's email address was changed to ${to} after you opened the preview, so nothing was sent. Check the address, then press Send quote email again if it's right.`,
    };
  }

  const businessName = business?.business_name ?? "";
  const message = (f.message ?? "").trim();
  // A blank subject becomes the quote subject the preview started with.
  const subject = cleanSubject(f.subject, f.title.trim(), defaultQuoteSubject(businessName, f.title.trim()));
  const text = composeEmailText(message, businessName);

  // The same email to the same person moments ago (a second tab, a repeated
  // submit): don't send it twice, and don't save a second quote for it.
  if (await deps.sentRecently({ to, subject, text })) {
    return {
      ok: false,
      locked: true,
      error: `You sent this exact email to ${to} a few minutes ago, so it wasn't sent again and no new quote was saved.`,
    };
  }

  // Saved as a draft first: nothing says "sent" until the provider accepts it.
  const quoteId = await deps.createQuote(quoteRow(f, customer.id, "draft"));

  let logId: string;
  try {
    // Claims a slot against the send limits as it writes the log, so two sends
    // started at the same moment can't both get through.
    logId = await deps.insertLog({
      quote_id: quoteId,
      lead_id: customer.id,
      follow_up_id: null,
      recipient_email: to,
      subject,
      body: text,
      status: "pending",
      quote_email: true,
    });
  } catch (e) {
    if (isEmailQuotaError(e)) {
      return {
        ok: false,
        quoteSaved: true,
        quoteId,
        error: `${e.message} Your quote is saved as a draft and was not marked as sent.`,
      };
    }
    if (isEmailRefusedError(e)) {
      // The database caught what the early check couldn't: another tab sent
      // the same thing at the same moment. Nothing went out from this one.
      if (e.reason === "repeat") {
        const discarded = deps.discardDraft ? await deps.discardDraft(quoteId).catch(() => false) : false;
        return discarded
          ? {
              ok: false,
              locked: true,
              error: `You sent this exact email to ${to} a moment ago, so it wasn't sent again and no new quote was saved.`,
            }
          : {
              ok: false,
              locked: true,
              quoteSaved: Boolean(deps.discardDraft),
              quoteId,
              error: `You sent this exact email to ${to} a moment ago, so it wasn't sent again.`,
            };
      }
      return {
        ok: false,
        locked: true,
        error:
          "This quote email was already sent from QuoteLoop, maybe in another tab, so it wasn't sent again. Use “I already sent this” on the quote to start its follow-up reminders.",
      };
    }
    // Nothing was sent, but the draft exists: let the caller say so.
    throw Object.assign(e instanceof Error ? e : new Error(String(e)), { savedQuoteId: quoteId });
  }

  const result = await deps.send({
    from: formatFrom(deps.config.from, businessName),
    to,
    subject,
    text,
    replyTo,
  });

  if (!result.ok) {
    if (result.uncertain) {
      // No clear answer: it may still arrive, so don't invite a second send.
      await deps.updateLog(logId, { error_message: result.reason }).catch(() => {});
      return {
        ok: false,
        unconfirmed: true,
        quoteSaved: true,
        quoteId,
        error: `We couldn't confirm the quote email was sent: ${result.reason}. It may still reach the customer, so sending it again could send it twice. The quote is saved as a draft and was not marked as sent.`,
      };
    }
    await deps.updateLog(logId, { status: "failed", error_message: result.reason }).catch(() => {});
    return {
      ok: false,
      quoteSaved: true,
      quoteId,
      error: `The quote email wasn't sent: ${result.reason}. Nothing was marked as sent, and your quote is saved as a draft.`,
    };
  }

  // The email is out. From here on we must never report failure.
  const warnings: string[] = [];
  try {
    await deps.updateLog(logId, {
      status: "sent",
      provider_message_id: result.id,
      sent_at: deps.now().toISOString(),
    });
  } catch {
    warnings.push("The quote email was sent, but its log entry couldn't be updated.");
  }

  try {
    // The send just happened, so today is the day the customer got it.
    await deps.markSent(quoteId, customer.id, today);
  } catch (e) {
    warnings.push(
      markSentStage(e) === "schedule"
        ? "The quote email was sent and the quote is marked as sent, but its follow-up reminders couldn't be scheduled."
        : "The quote email was sent, but the quote couldn't be marked as sent, so no follow-up reminders were scheduled. QuoteLoop won't send it again: use “I already sent this” on the quote to start its reminders."
    );
  }

  let schedule: ScheduledFollowUp[] = [];
  try {
    schedule = await deps.getSchedule(quoteId);
  } catch {
    /* the confirmation simply shows no dates */
  }

  return {
    ok: true,
    quoteId,
    customerName: customer.customer_name,
    recipient: to,
    schedule,
    hasCustomerEmail: true,
    followUpDueNow: scheduleNeedsAttention(schedule, today),
    warning: warnings.length ? warnings.join(" ") : undefined,
  };
}

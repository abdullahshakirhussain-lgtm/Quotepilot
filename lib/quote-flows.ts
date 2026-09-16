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
import {
  cleanSubject,
  composeEmailText,
  formatFrom,
  isEmailQuotaError,
  isValidEmail,
  MAX_BODY_LENGTH,
  quotaError,
  type EmailConfig,
  type OutgoingEmail,
  type SendResult,
} from "./email";

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
      /** The quote was saved (as a draft) even though the email wasn't sent. */
      quoteSaved?: boolean;
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

/** A positive money amount, or null when it isn't one. */
export function parseAmount(value: string | number | null | undefined): number | null {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[, ]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
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

  const email = f.email?.trim();
  if (flow === "send") {
    if (!email) return "Enter the customer's email address so QuoteLoop can send the quote.";
    if (!isValidEmail(email)) return "That email address doesn't look right. Check it and try again.";
  } else if (email && !isValidEmail(email)) {
    return "That email address doesn't look right. Leave it empty if you don't have one.";
  }

  if (!f.title?.trim()) return "Add a short title for the quote, like “Service 3 AC units”.";
  if (parseAmount(f.amount) === null) return "Enter the quote amount as a number greater than zero.";
  if (!(CURRENCIES as readonly string[]).includes(String(f.currency ?? "").toUpperCase())) {
    return "Choose a currency.";
  }

  if (!f.sentDate || !DATE.test(f.sentDate)) {
    return flow === "track" ? "Enter the date you sent this quote." : "The quote date isn't valid.";
  }
  if (flow === "track" && f.sentDate > today) return "The sent date can't be in the future.";

  if (f.validUntil) {
    if (!DATE.test(f.validUntil)) return "The valid-until date isn't valid.";
    if (f.validUntil < f.sentDate) {
      return flow === "track"
        ? "The valid-until date can't be before the sent date."
        : "The valid-until date can't be before today.";
    }
  }

  if (flow === "send") {
    const message = (f.message ?? "").trim();
    if (!message) return "Write the quote email before sending it.";
    if (message.length > MAX_BODY_LENGTH) return "This email is too long to send.";
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
}

export interface SendQuoteDeps extends TrackQuoteDeps {
  config: EmailConfig | null;
  getBusiness(): Promise<{ business_name: string; email: string | null } | null>;
  countRecentEmails(): Promise<{ day: number; month: number }>;
  /**
   * Writes the 'pending' audit log AND claims a slot against the send limits,
   * throwing an EmailQuotaError when the user is already at one. Nothing is
   * sent unless this succeeds, so two simultaneous sends can't both pass.
   */
  insertLog(row: {
    quote_id: string;
    lead_id: string;
    follow_up_id: null;
    recipient_email: string;
    subject: string;
    body: string;
    status: "pending";
  }): Promise<string>;
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

  const customer = await deps.resolveCustomer(f);
  const quoteId = await deps.createQuote(quoteRow(f, customer.id, "sent"));

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

  const limit = quotaError(await deps.countRecentEmails());
  if (limit) return { ok: false, error: limit };

  const customer = await deps.resolveCustomer(f);
  // The recipient always comes from the saved customer, never from the browser.
  const to = customer.email?.trim() ?? "";
  if (!isValidEmail(to)) {
    return { ok: false, error: "This customer has no valid email address saved, so the quote can't be sent." };
  }

  const business = await deps.getBusiness();
  const businessName = business?.business_name ?? "";
  const message = (f.message ?? "").trim();
  const subject = cleanSubject(f.subject, f.title.trim());
  const text = composeEmailText(message, businessName);
  const replyTo = isValidEmail(business?.email) ? business!.email!.trim() : deps.config.replyToFallback;

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
    });
  } catch (e) {
    if (!isEmailQuotaError(e)) throw e;
    return {
      ok: false,
      quoteSaved: true,
      error: `${e.message} Your quote is saved as a draft and was not marked as sent.`,
    };
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
        error: `We couldn't confirm the quote email was sent: ${result.reason}. It may still reach the customer, so sending it again could send it twice. The quote is saved as a draft and was not marked as sent.`,
      };
    }
    await deps.updateLog(logId, { status: "failed", error_message: result.reason }).catch(() => {});
    return {
      ok: false,
      quoteSaved: true,
      error: `The quote email was not sent. Nothing was marked as sent. (${result.reason}.) Your quote is saved as a draft, so you can try again.`,
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
  } catch {
    warnings.push(
      "The quote email was sent, but the quote is still saved as a draft and no follow-up reminders were scheduled."
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

// ---------------------------------------------------------------------------
// The "send a follow-up email" workflow, with every dependency injected so the
// success / failure / partial-failure paths can be tested without a database
// or email provider. The server action wires real Supabase + Resend calls.
//
// Order matters:
//   1. validate + ownership (deps only ever return the caller's own rows)
//   2. rate limit
//   3. write a 'pending' audit log  -> if this fails, nothing is sent
//   4. send                         -> rejected: log 'failed', follow-up untouched
//                                      no clear answer (e.g. timeout): log stays
//                                      'pending', since it may have been delivered
//   5. log 'sent', then complete the reminder with the final text + recompute
// ---------------------------------------------------------------------------
import {
  cleanSubject,
  composeEmailText,
  formatFrom,
  isValidEmail,
  MAX_BODY_LENGTH,
  quotaError,
  type EmailConfig,
  type OutgoingEmail,
  type SendResult,
} from "./email";

export interface EmailLogInsert {
  quote_id: string;
  lead_id: string;
  follow_up_id: string | null;
  recipient_email: string;
  subject: string;
  body: string;
  status: "pending";
}

export interface EmailLogPatch {
  /** Omitted when the outcome is unknown: the log then stays 'pending'. */
  status?: "sent" | "failed";
  provider_message_id?: string | null;
  sent_at?: string;
  error_message?: string;
}

export interface SendDeps {
  config: EmailConfig | null;
  /** All lookups must be scoped to the authenticated user (null if not theirs). */
  getQuote(quoteId: string): Promise<{ id: string; title: string; lead_id: string } | null>;
  getLead(leadId: string): Promise<{ id: string; email: string | null } | null>;
  getBusiness(): Promise<{ business_name: string; email: string | null } | null>;
  countRecentEmails(): Promise<{ day: number; month: number }>;
  getPendingFollowUp(quoteId: string): Promise<{ id: string; follow_up_number: number } | null>;
  insertLog(row: EmailLogInsert): Promise<string>;
  updateLog(id: string, patch: EmailLogPatch): Promise<void>;
  /** Completes a still-pending reminder; false if it was no longer pending. */
  completeFollowUp(followUpId: string, finalText: string, at: string): Promise<boolean>;
  recompute(quoteId: string): Promise<{ next_follow_up_at: string | null }>;
  send(email: OutgoingEmail): Promise<SendResult>;
  now(): Date;
}

export type SendOutcome =
  | {
      ok: false;
      error: string;
      /** No clear answer from the provider: the email may have gone out anyway. */
      unconfirmed?: boolean;
    }
  | {
      ok: true;
      recipient: string;
      /** This email completed the quote's pending reminder. */
      followUpLogged: boolean;
      followUpNumber: number | null;
      /** Undefined when the quote's follow-up summary couldn't be refreshed. */
      nextFollowUpAt?: string | null;
      /** Sent, but its reminder is still pending: record it with "Mark as followed up". */
      needsManualLog?: boolean;
      warning?: string;
    };

export async function sendFollowUpEmailCore(
  deps: SendDeps,
  input: { quoteId: string; subject?: string | null; message: string }
): Promise<SendOutcome> {
  if (!deps.config) {
    return { ok: false, error: "Email sending isn't set up yet. You can still copy the message and send it yourself." };
  }

  const message = (input.message ?? "").trim();
  if (!message) return { ok: false, error: "Write or generate a message before sending." };
  if (message.length > MAX_BODY_LENGTH) return { ok: false, error: "This message is too long to send." };

  const quote = await deps.getQuote(input.quoteId);
  if (!quote) return { ok: false, error: "Quote not found." };
  const lead = await deps.getLead(quote.lead_id);
  if (!lead) return { ok: false, error: "Customer not found." };

  // The recipient always comes from the saved customer, never from the client.
  const to = lead.email?.trim() ?? "";
  if (!isValidEmail(to)) {
    return { ok: false, error: "Add a valid email address to this customer to send from QuoteLoop." };
  }

  const limit = quotaError(await deps.countRecentEmails());
  if (limit) return { ok: false, error: limit };

  const business = await deps.getBusiness();
  const businessName = business?.business_name ?? "";
  const subject = cleanSubject(input.subject, quote.title);
  const text = composeEmailText(message, businessName);
  const replyTo = isValidEmail(business?.email) ? business!.email!.trim() : deps.config.replyToFallback;
  const pending = await deps.getPendingFollowUp(quote.id);

  // Audit first: if the log can't be written, nothing is sent.
  const logId = await deps.insertLog({
    quote_id: quote.id,
    lead_id: lead.id,
    follow_up_id: pending?.id ?? null,
    recipient_email: to,
    subject,
    body: text,
    status: "pending",
  });

  const result = await deps.send({
    from: formatFrom(deps.config.from, businessName),
    to,
    subject,
    text,
    replyTo,
  });

  if (!result.ok) {
    if (result.uncertain) {
      // No clear answer, so it may still be delivered. The log stays 'pending'
      // (it still counts toward the limits) and we don't invite a second send.
      await deps.updateLog(logId, { error_message: result.reason }).catch(() => {});
      return {
        ok: false,
        unconfirmed: true,
        error: `We couldn't confirm the email was sent: ${result.reason}. It may still reach the customer, so sending it again could duplicate it. Nothing was marked as done.`,
      };
    }
    await deps.updateLog(logId, { status: "failed", error_message: result.reason }).catch(() => {});
    return { ok: false, error: `The email wasn't sent: ${result.reason}. Nothing was marked as done.` };
  }

  // The email is out. From here on we must never report failure.
  const sentAt = deps.now().toISOString();
  const warnings: string[] = [];
  const warning = () => (warnings.length ? warnings.join(" ") : undefined);
  try {
    await deps.updateLog(logId, { status: "sent", provider_message_id: result.id, sent_at: sentAt });
  } catch {
    warnings.push("The email was sent, but its log entry couldn't be updated.");
  }

  const base = { ok: true as const, recipient: to };
  if (!pending) {
    return { ...base, followUpLogged: false, followUpNumber: null, nextFollowUpAt: null, warning: warning() };
  }

  let completed: boolean;
  try {
    completed = await deps.completeFollowUp(pending.id, message, sentAt);
  } catch {
    warnings.push(
      "The email was sent, but the reminder couldn't be marked as done. Use “Mark as followed up” to record it."
    );
    return { ...base, followUpLogged: false, followUpNumber: null, needsManualLog: true, warning: warning() };
  }

  // The counters are derived from the reminder rows. If refreshing them fails
  // the reminder is still recorded; they catch up on the quote's next change.
  let nextFollowUpAt: string | null | undefined;
  try {
    nextFollowUpAt = (await deps.recompute(quote.id)).next_follow_up_at;
  } catch {
    warnings.push("The quote's follow-up count and next date couldn't be refreshed.");
  }

  if (!completed) {
    warnings.push("This reminder had already been marked done.");
    return { ...base, followUpLogged: false, followUpNumber: null, nextFollowUpAt, warning: warning() };
  }
  return {
    ...base,
    followUpLogged: true,
    followUpNumber: pending.follow_up_number,
    nextFollowUpAt,
    warning: warning(),
  };
}

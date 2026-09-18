// ---------------------------------------------------------------------------
// The "send a follow-up email" workflow, with every dependency injected so the
// success / failure / partial-failure paths can be tested without a database
// or email provider. The server action wires real Supabase + Resend calls.
//
// Order matters:
//   1. validate + ownership (deps only ever return the caller's own rows)
//   1b. one email per reminder: stop if this reminder was already emailed, or
//       an earlier attempt was never confirmed
//   2. rate limit (checked here for a fast answer, and enforced again by the
//      log write, which claims a slot so two sends at once can't both pass)
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

export interface EmailLogInsert {
  quote_id: string;
  lead_id: string;
  follow_up_id: string | null;
  recipient_email: string;
  subject: string;
  body: string;
  status: "pending";
  /** The email that sends a draft quote (not a follow-up): one per quote. Not a column. */
  quote_email?: boolean;
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
  /** True when this exact email went to this recipient in the last few minutes. */
  sentRecently(email: { to: string; subject: string; text: string }): Promise<boolean>;
  getPendingFollowUp(quoteId: string): Promise<{ id: string; follow_up_number: number } | null>;
  /**
   * An earlier email for this reminder: "sent" if one went out, "pending" if one
   * was never confirmed, null if none (failed attempts don't count).
   */
  getEarlierAttempt(followUpId: string): Promise<"sent" | "pending" | null>;
  /** Writes the log AND claims a send slot; throws EmailQuotaError if at a limit. */
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
      /** Sending this reminder again must not be offered. */
      locked?: boolean;
      /**
       * The customer's saved address changed since the user reviewed the email.
       * Nothing was sent; this is the address a new attempt would go to.
       */
      recipientChanged?: string;
      /** Nothing was sent because the business has no working email to reply to. */
      needsBusinessEmail?: boolean;
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
  input: {
    quoteId: string;
    subject?: string | null;
    message: string;
    /**
     * The address the user saw on screen. Only ever used to refuse: the email
     * still goes to the saved address, and only if it is this one.
     */
    expectedTo?: string | null;
    /**
     * The reminder that was due when the user opened the message. If it has
     * since been recorded (another tab), nothing is sent.
     */
    expectedFollowUpId?: string | null;
  }
): Promise<SendOutcome> {
  if (!deps.config) {
    return { ok: false, error: "Email sending isn't set up yet. You can still copy the message and send it yourself." };
  }

  const message = (input.message ?? "").trim();
  if (!message) return { ok: false, error: "Write or generate a message before sending." };
  if (message.length > MAX_BODY_LENGTH) {
    return {
      ok: false,
      error: `This message is too long to send. Keep it under ${MAX_BODY_LENGTH.toLocaleString("en-US")} characters.`,
    };
  }

  const quote = await deps.getQuote(input.quoteId);
  if (!quote) {
    return { ok: false, error: "This quote no longer exists (it may have been deleted in another tab), so nothing was sent." };
  }
  const lead = await deps.getLead(quote.lead_id);
  if (!lead) {
    return { ok: false, error: "This quote's customer no longer exists, so nothing was sent." };
  }

  // The recipient always comes from the saved customer, never from the client.
  const to = lead.email?.trim() ?? "";
  if (!isValidEmail(to)) {
    return { ok: false, error: "Add a valid email address to this customer to send from QuoteLoop." };
  }
  if (input.expectedTo?.trim() && !sameAddress(input.expectedTo, to)) {
    return {
      ok: false,
      recipientChanged: to,
      error: `This customer's email address was changed to ${to} after you opened this, so nothing was sent. Check the address, then press Send email again if it's right.`,
    };
  }

  const pending = await deps.getPendingFollowUp(quote.id);

  // Opened for a reminder that has since been recorded (e.g. in another tab):
  // sending now would count as the next follow-up, a second email in minutes.
  if (typeof input.expectedFollowUpId === "string" && pending?.id !== input.expectedFollowUpId) {
    return {
      ok: false,
      locked: true,
      error:
        "This follow-up was already recorded, maybe in another tab, so nothing was sent. Close this window and check the quote before following up again.",
    };
  }

  // One email per reminder: never send one that already went out, or may have.
  if (pending) {
    const earlier = await deps.getEarlierAttempt(pending.id);
    if (earlier === "sent") {
      return {
        ok: false,
        locked: true,
        error: `Follow-up #${pending.follow_up_number} was already emailed from QuoteLoop, so it won't be sent again. Use “Mark as followed up” to record it.`,
      };
    }
    if (earlier === "pending") {
      return {
        ok: false,
        locked: true,
        unconfirmed: true,
        error: `QuoteLoop couldn't confirm whether an earlier email for follow-up #${pending.follow_up_number} was delivered, so it may already have reached your customer. To avoid sending it twice, it won't be sent again. If they didn't get it, copy the message, send it yourself and use “Mark as followed up”.`,
      };
    }
  }

  // Replies go to the business; without a real address they'd be lost.
  const business = await deps.getBusiness();
  const replyTo = business?.email?.trim() ?? "";
  if (!isValidEmail(replyTo)) return { ok: false, needsBusinessEmail: true, error: NEEDS_BUSINESS_EMAIL };

  const limit = quotaError(await deps.countRecentEmails());
  if (limit) return { ok: false, error: limit };

  const businessName = business?.business_name ?? "";
  const subject = cleanSubject(input.subject, quote.title);
  const text = composeEmailText(message, businessName);

  // The same email to the same person moments ago (another tab): don't repeat it.
  if (await deps.sentRecently({ to, subject, text })) {
    return {
      ok: false,
      locked: true,
      error: `You sent this exact email to ${to} a few minutes ago, so it wasn't sent again.`,
    };
  }

  // Audit first: if the log can't be written, nothing is sent.
  let logId: string;
  try {
    logId = await deps.insertLog({
      quote_id: quote.id,
      lead_id: lead.id,
      follow_up_id: pending?.id ?? null,
      recipient_email: to,
      subject,
      body: text,
      status: "pending",
    });
  } catch (e) {
    if (isEmailQuotaError(e)) return { ok: false, error: e.message };
    if (isEmailRefusedError(e)) {
      // Found by the database inside its lock: another tab got there first.
      return {
        ok: false,
        locked: true,
        error:
          e.reason === "repeat"
            ? `You sent this exact email to ${to} a few minutes ago, so it wasn't sent again.`
            : `An email for follow-up #${pending?.follow_up_number ?? ""} was already sent from QuoteLoop, maybe in another tab, so this one wasn't sent. Use “Mark as followed up” if it still needs recording.`,
      };
    }
    throw e;
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
      // No clear answer, so it may still be delivered. The log stays 'pending'
      // (it still counts toward the limits) and we don't invite a second send.
      await deps.updateLog(logId, { error_message: result.reason }).catch(() => {});
      return {
        ok: false,
        unconfirmed: true,
        error: `We couldn't confirm the email was sent: ${result.reason}. It may still reach the customer, so sending it again could duplicate it. No follow-up was recorded.`,
      };
    }
    await deps.updateLog(logId, { status: "failed", error_message: result.reason }).catch(() => {});
    return { ok: false, error: `The email wasn't sent: ${result.reason}. No follow-up was recorded.` };
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
      "The email was sent, but the follow-up couldn't be recorded. Use “Mark as followed up” to record it."
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
    warnings.push("This follow-up had already been recorded.");
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

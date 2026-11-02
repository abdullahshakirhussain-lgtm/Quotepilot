import { emailConfig, sendViaResend } from "@/lib/email";
import { CONTACT_EMAIL } from "@/lib/marketing";

/**
 * Tells the owner about something in billing that needs a person (a refund, a
 * chargeback, a customer paying twice). Always in the server log, and by email
 * to BILLING_ALERT_EMAIL (default: the contact address) when email is set up.
 * Never holds up the webhook, and a failed email never fails it.
 */
export function alertOwner(subject: string, text: string) {
  console.error(`[billing] ALERT: ${subject}. ${text}`);
  const config = emailConfig();
  if (!config) return;
  const to = process.env.BILLING_ALERT_EMAIL?.trim() || CONTACT_EMAIL;
  void sendViaResend(config, { from: config.from, to, subject: `QuoteLoop billing: ${subject}`, text, replyTo: null });
}

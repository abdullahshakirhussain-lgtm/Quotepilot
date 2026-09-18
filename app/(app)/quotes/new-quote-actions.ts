"use server";

// Server actions for the two first-use quote flows. Every lookup and write is
// scoped to the signed-in user; the email recipient always comes from the saved
// customer, never from the browser.
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, requireUser } from "@/lib/supabase/server";
import { cleanPasted, emailConfig, isValidEmail, sendViaResend, type EmailConfig } from "@/lib/email";
import { countRecentEmails, emailLogWriter, sentRecently } from "@/lib/email-quota";
import { applyQuoteStatusChange } from "@/lib/quote-state";
import { requestToday } from "@/lib/request-time";
import { findSimilarQuote, isCustomerGoneError, resolveCustomerRecord } from "@/lib/quote-write";
import {
  LIMITS,
  MarkSentError,
  sendQuoteCore,
  trackQuoteCore,
  type CustomerRecord,
  type QuoteFields,
  type QuoteFlowOutcome,
  type ScheduledFollowUp,
  type SendQuoteDeps,
  type TrackQuoteDeps,
} from "@/lib/quote-flows";
import { clip } from "@/lib/utils";

function check(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

/** The database is missing a column this build knows about. */
function missingColumn(error: { message: string; code?: string }, column: string): boolean {
  return (
    (error.code === "PGRST204" || error.code === "42703" || /column|schema cache/i.test(error.message)) &&
    error.message.includes(column)
  );
}

/** The customer picked in the form was deleted meanwhile (e.g. in another tab). */
const CUSTOMER_GONE =
  "The customer you picked no longer exists — they may have been deleted in another tab. Choose another customer, or add them as a new one.";

/** A send that stopped before anything went out; says whether a draft was kept. */
function stoppedBeforeSending(e: unknown): QuoteFlowOutcome {
  if (isCustomerGoneError(e)) return { ok: false, error: `${CUSTOMER_GONE} Nothing was sent.` };
  const quoteId = (e as { savedQuoteId?: string } | null)?.savedQuoteId;
  return quoteId
    ? {
        ok: false,
        quoteSaved: true,
        quoteId,
        error: "QuoteLoop couldn't send the quote just now, so nothing was sent. Your quote is saved as a draft, so you can try again.",
      }
    : { ok: false, error: "QuoteLoop couldn't send the quote just now, so nothing was sent. Please try again." };
}

/**
 * The most telling earlier quote email for a quote: "sent" if one went out,
 * "pending" if one was never confirmed, otherwise null. Failed attempts don't
 * count — they definitely didn't go out.
 */
async function earlierQuoteEmail(
  supabase: SupabaseClient,
  uid: string,
  quoteId: string
): Promise<"sent" | "pending" | null> {
  const { data, error } = await supabase
    .from("email_logs")
    .select("status")
    .eq("quote_id", quoteId)
    .eq("user_id", uid)
    .in("status", ["pending", "sent"]);
  check(error, "email history lookup");
  const statuses = (data ?? []).map((r) => r.status);
  return statuses.includes("sent") ? "sent" : statuses.includes("pending") ? "pending" : null;
}

function revalidateViews() {
  for (const path of ["/quotes", "/follow-ups", "/dashboard", "/pipeline", "/leads"]) {
    revalidatePath(path);
  }
}

/** Longest input read from the browser before validation looks at it. */
const MAX_INPUT = 20_000;

/**
 * Bounds what the browser sends. Text is only capped far above the real
 * limits, so anything too long is refused by validateQuote with a message
 * instead of being quietly cut.
 */
function clean(input: QuoteFields, sentDate: string): QuoteFields {
  return {
    customerMode: input?.customerMode === "existing" ? "existing" : "new",
    leadId: input?.leadId ? String(input.leadId) : null,
    customerName: clip(input?.customerName ?? "", MAX_INPUT),
    // Pasted addresses and numbers often carry invisible characters.
    email: clip(cleanPasted(input?.email), 320),
    phone: clip(cleanPasted(input?.phone), MAX_INPUT),
    companyName: clip(input?.companyName ?? "", MAX_INPUT),
    title: clip(input?.title ?? "", MAX_INPUT),
    amount: input?.amount ?? "",
    currency: String(input?.currency ?? "USD"),
    sentDate,
    validUntil: clip(input?.validUntil ?? "", 20) || null,
    description: clip(input?.description ?? "", MAX_INPUT) || null,
    notes: clip(input?.notes ?? "", MAX_INPUT) || null,
    sentMethod: clip(input?.sentMethod ?? "", 40) || null,
    subject: clip(input?.subject ?? "", 200),
    message: clip(input?.message ?? "", MAX_INPUT),
    // Compared with the saved address only; never used as the recipient.
    expectedTo: clip(cleanPasted(input?.expectedTo), 320) || null,
    allowDuplicate: input?.allowDuplicate === true,
  };
}

function quoteDeps(supabase: SupabaseClient, uid: string): TrackQuoteDeps {
  return {
    resolveCustomer: (f) => resolveCustomerRecord(supabase, uid, f),
    async createQuote(row) {
      const insert = (values: object) =>
        supabase.from("quotes").insert({ ...values, user_id: uid }).select("id").single();

      let { data, error } = await insert(row);
      if (error && missingColumn(error, "sent_method")) {
        // This database hasn't had schema.sql re-run yet. Saving the quote
        // matters more than recording how it was sent.
        const { sent_method: _dropped, ...rest } = row;
        ({ data, error } = await insert(rest));
      }
      check(error, "saving the quote");
      return data!.id as string;
    },
    async markSent(quoteId, leadId, scheduleFrom) {
      // The quote's date is the day it actually went out, matching its reminders.
      const { error } = await supabase
        .from("quotes")
        .update({ status: "sent", quote_date: scheduleFrom })
        .eq("id", quoteId)
        .eq("user_id", uid);
      if (error) throw new MarkSentError("status", error.message);
      try {
        // Same path as the status buttons: schedules reminders, moves the
        // customer along the pipeline and re-derives the quote's counters.
        await applyQuoteStatusChange(
          supabase,
          uid,
          { id: quoteId, lead_id: leadId },
          "draft",
          "sent",
          { scheduleFrom }
        );
      } catch (e) {
        throw new MarkSentError("schedule", e);
      }
    },
    async getSchedule(quoteId) {
      const { data, error } = await supabase
        .from("follow_ups")
        .select("follow_up_number, due_date")
        .eq("quote_id", quoteId)
        .eq("user_id", uid)
        .eq("status", "pending")
        .order("due_date", { ascending: true });
      check(error, "reading the follow-up schedule");
      return (data ?? []) as ScheduledFollowUp[];
    },
    findExistingQuote: (f) => findSimilarQuote(supabase, uid, f),
  };
}

function emailDeps(
  supabase: SupabaseClient,
  uid: string,
  config: EmailConfig | null
): Omit<SendQuoteDeps, keyof TrackQuoteDeps> {
  const logs = emailLogWriter(supabase, uid);
  return {
    config,
    async getBusiness() {
      const { data, error } = await supabase
        .from("businesses")
        .select("business_name, email")
        .eq("user_id", uid)
        .maybeSingle();
      check(error, "workspace lookup");
      return data;
    },
    countRecentEmails: () => countRecentEmails(supabase, uid),
    sentRecently: (email) => sentRecently(supabase, uid, email),
    // Writes the audit log and claims a slot; the outcome is recorded with the
    // one-time token the database handed back, which stays on the server.
    insertLog: (row) => logs.insert(row),
    updateLog: (id, patch) => logs.update(id, patch),
    send: (email) => sendViaResend(config!, email),
    now: () => new Date(),
  };
}

/**
 * Flow B - "Track a quote already sent". Saves the quote as sent and schedules
 * follow-up reminders. Never sends an email.
 */
export async function trackQuoteAlreadySent(input: QuoteFields): Promise<QuoteFlowOutcome> {
  const user = await requireUser();
  const supabase = await createClient();
  const today = await requestToday();

  try {
    const fields = clean(input, String(input?.sentDate ?? "").slice(0, 20));
    const outcome = await trackQuoteCore(quoteDeps(supabase, user.id), fields, today);
    if (outcome.ok || (!outcome.ok && outcome.quoteSaved)) revalidateViews();
    return outcome;
  } catch (e) {
    if (isCustomerGoneError(e)) return { ok: false, error: CUSTOMER_GONE };
    console.error("[quotes] tracking an existing quote failed:", e);
    return { ok: false, error: "The quote couldn't be saved just now. Please try again." };
  }
}

/**
 * Flow A - "Send a quote with QuoteLoop". The quote is saved as a draft, the
 * email is sent, and only then is it marked sent with reminders scheduled.
 */
export async function sendQuoteWithQuoteLoop(input: QuoteFields): Promise<QuoteFlowOutcome> {
  const user = await requireUser();
  const supabase = await createClient();
  const today = await requestToday();
  const config = emailConfig();

  try {
    // The send date is the server's today; the browser doesn't get a say.
    const fields = clean(input, today);
    const deps: SendQuoteDeps = {
      ...quoteDeps(supabase, user.id),
      ...emailDeps(supabase, user.id, config),
      // Refused as a repeat after the draft was written: remove that new draft.
      async discardDraft(quoteId) {
        const { data, error } = await supabase
          .from("quotes")
          .delete()
          .eq("id", quoteId)
          .eq("user_id", user.id)
          .eq("status", "draft")
          .select("id");
        return !error && Boolean(data?.length);
      },
    };
    const outcome = await sendQuoteCore(deps, fields, today);
    if (outcome.ok || (!outcome.ok && outcome.quoteSaved)) revalidateViews();
    return outcome;
  } catch (e) {
    // Only steps BEFORE the send can throw here, so nothing went out.
    console.error("[quotes] send flow stopped before sending:", e);
    return stoppedBeforeSending(e);
  }
}

/**
 * Sends the quote email for a quote already saved as a draft (the "Send quote
 * email" action on a draft card). Same rules as flow A.
 */
export async function sendDraftQuoteEmail(input: {
  quoteId: string;
  subject: string;
  message: string;
  /** The address the preview showed; if the saved one differs, nothing is sent. */
  expectedTo?: string | null;
}): Promise<QuoteFlowOutcome> {
  const user = await requireUser();
  const supabase = await createClient();
  const today = await requestToday();
  const config = emailConfig();

  try {
    const { data: quote, error } = await supabase
      .from("quotes")
      .select("id, lead_id, title, description, amount, currency, valid_until, notes, status")
      .eq("id", String(input?.quoteId ?? ""))
      .eq("user_id", user.id)
      .maybeSingle();
    check(error, "quote lookup");
    if (!quote) {
      return { ok: false, error: "This quote no longer exists (it may have been deleted in another tab), so nothing was sent." };
    }
    if (quote.status !== "draft") {
      return { ok: false, locked: true, error: "This quote is already marked as sent, so the quote email wasn't sent again." };
    }

    // Never send the same quote twice. While a quote is a draft, any email logged
    // against it is an earlier attempt to send this quote.
    const earlier = await earlierQuoteEmail(supabase, user.id, String(quote.id));
    if (earlier === "sent") {
      return {
        ok: false,
        locked: true,
        error:
          "This quote email was already sent from QuoteLoop, so it won't be sent again. Use “I already sent this” on the quote to start its follow-up reminders.",
      };
    }
    if (earlier === "pending") {
      return {
        ok: false,
        locked: true,
        unconfirmed: true,
        error:
          "QuoteLoop couldn't confirm whether an earlier attempt to send this quote was delivered, so it may already have reached your customer. To avoid sending it twice, it won't be sent again from here. If they have it, use “I already sent this”; if not, copy the email and send it yourself.",
      };
    }

    const { data: customer, error: leadError } = await supabase
      .from("leads")
      .select("id, customer_name, email")
      .eq("id", quote.lead_id)
      .eq("user_id", user.id)
      .maybeSingle();
    check(leadError, "customer lookup");
    if (!customer) return { ok: false, error: "This quote's customer no longer exists, so nothing was sent." };
    if (!isValidEmail((customer as CustomerRecord).email)) {
      return {
        ok: false,
        error:
          "This customer doesn't have a valid email address any more, so the quote can't be sent. Add one on the Customers page, or use “I already sent this” if you sent it another way.",
      };
    }

    const deps: SendQuoteDeps = {
      ...quoteDeps(supabase, user.id),
      ...emailDeps(supabase, user.id, config),
      // The quote already exists: reuse it instead of creating another.
      resolveCustomer: async () => customer as CustomerRecord,
      createQuote: async () => quote.id as string,
    };

    const validUntil =
      quote.valid_until && String(quote.valid_until) >= today ? String(quote.valid_until) : null;
    const fields: QuoteFields = {
      customerMode: "existing",
      leadId: quote.lead_id,
      email: (customer as CustomerRecord).email ?? "",
      // Saved details aren't being edited here, so older, longer text on the
      // quote must not block sending it.
      title: String(quote.title).slice(0, LIMITS.title),
      amount: quote.amount as number,
      currency: String(quote.currency),
      sentDate: today,
      validUntil,
      description: null,
      notes: null,
      subject: clip(input?.subject ?? "", 200),
      message: clip(input?.message ?? "", MAX_INPUT),
      expectedTo: clip(cleanPasted(input?.expectedTo), 320) || null,
    };

    const outcome = await sendQuoteCore(deps, fields, today);
    if (outcome.ok || (!outcome.ok && outcome.quoteSaved)) revalidateViews();
    return outcome;
  } catch (e) {
    console.error("[quotes] draft send stopped before sending:", e);
    return stoppedBeforeSending(e);
  }
}

/**
 * Saves an email address on one of the caller's own customers, so a draft quote
 * that had nowhere to go can be sent from QuoteLoop.
 */
export async function addCustomerEmail(
  leadId: string,
  email: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const supabase = await createClient();
  // Pasted addresses often carry invisible characters.
  const address = cleanPasted(clip(email ?? "", 320));
  if (!isValidEmail(address)) {
    return { ok: false, error: "That email address doesn't look right. Check it and try again." };
  }

  try {
    const { data, error } = await supabase
      .from("leads")
      .update({ email: address })
      .eq("id", String(leadId ?? ""))
      .eq("user_id", user.id)
      .select("id");
    check(error, "saving the customer's email");
    if (!data?.length) return { ok: false, error: "That customer was not found." };
  } catch (e) {
    console.error("[quotes] saving a customer email failed:", e);
    return { ok: false, error: "The email address couldn't be saved just now. Please try again." };
  }

  revalidateViews();
  return { ok: true };
}

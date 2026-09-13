"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";
import { emailConfig, sendViaResend, MAX_BODY_LENGTH } from "@/lib/email";
import { sendFollowUpEmailCore, type SendOutcome } from "@/lib/email-send";
import { recomputeQuoteFollowUpState } from "@/lib/quote-state";
import { clip } from "@/lib/utils";

const DAY_MS = 86_400_000;

function check(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

/**
 * Sends ONE follow-up email the user explicitly asked to send, from the AI
 * assistant. Every lookup is scoped to the signed-in user, the recipient is the
 * saved customer email (never client input), and the reminder is only marked
 * done after the provider accepts the email.
 */
export async function sendFollowUpEmail(input: {
  quoteId: string;
  subject: string;
  message: string;
}): Promise<SendOutcome> {
  const user = await requireUser();
  const supabase = await createClient();
  const uid = user.id;
  const config = emailConfig();

  try {
    const outcome = await sendFollowUpEmailCore(
      {
        config,
        async getQuote(quoteId) {
          const { data, error } = await supabase
            .from("quotes")
            .select("id, title, lead_id")
            .eq("id", quoteId)
            .eq("user_id", uid)
            .maybeSingle();
          check(error, "quote lookup");
          return data;
        },
        async getLead(leadId) {
          const { data, error } = await supabase
            .from("leads")
            .select("id, email")
            .eq("id", leadId)
            .eq("user_id", uid)
            .maybeSingle();
          check(error, "customer lookup");
          return data;
        },
        async getBusiness() {
          const { data, error } = await supabase
            .from("businesses")
            .select("business_name, email")
            .eq("user_id", uid)
            .maybeSingle();
          check(error, "workspace lookup");
          return data;
        },
        async countRecentEmails() {
          const now = Date.now();
          const countSince = (ms: number) =>
            supabase
              .from("email_logs")
              .select("id", { count: "exact", head: true })
              .eq("user_id", uid)
              .in("status", ["pending", "sent"])
              .gte("created_at", new Date(now - ms).toISOString());
          const [day, month] = await Promise.all([countSince(DAY_MS), countSince(30 * DAY_MS)]);
          check(day.error ?? month.error, "email limit check");
          return { day: day.count ?? 0, month: month.count ?? 0 };
        },
        async getPendingFollowUp(quoteId) {
          const { data, error } = await supabase
            .from("follow_ups")
            .select("id, follow_up_number")
            .eq("quote_id", quoteId)
            .eq("user_id", uid)
            .eq("status", "pending")
            .order("due_date", { ascending: true })
            .limit(1);
          check(error, "reminder lookup");
          return data?.[0] ?? null;
        },
        async insertLog(row) {
          const { data, error } = await supabase
            .from("email_logs")
            .insert({ ...row, user_id: uid, provider: "resend" })
            .select("id")
            .single();
          check(error, "email log");
          return data!.id as string;
        },
        async updateLog(id, patch) {
          const { error } = await supabase
            .from("email_logs")
            .update(patch)
            .eq("id", id)
            .eq("user_id", uid);
          check(error, "email log update");
        },
        async completeFollowUp(followUpId, finalText, at) {
          const { data, error } = await supabase
            .from("follow_ups")
            .update({
              status: "completed",
              completed_at: at,
              message_snapshot: clip(finalText, MAX_BODY_LENGTH),
            })
            .eq("id", followUpId)
            .eq("user_id", uid)
            .eq("status", "pending")
            .select("id");
          check(error, "reminder update");
          return (data?.length ?? 0) > 0;
        },
        async recompute(quoteId) {
          const state = await recomputeQuoteFollowUpState(supabase, uid, quoteId);
          return { next_follow_up_at: state.next_follow_up_at };
        },
        send: (email) => sendViaResend(config!, email),
        now: () => new Date(),
      },
      {
        quoteId: String(input?.quoteId ?? ""),
        subject: String(input?.subject ?? ""),
        message: String(input?.message ?? ""),
      }
    );

    if (outcome.ok) {
      for (const path of ["/quotes", "/follow-ups", "/dashboard"]) revalidatePath(path);
    }
    return outcome;
  } catch (e) {
    // Only steps BEFORE the send can throw here (the send itself never throws
    // and post-send steps are handled inside the core), so nothing went out.
    console.error("[email] send action stopped before sending:", e);
    return {
      ok: false,
      error: "Email sending isn't available right now, so nothing was sent. You can still copy the message.",
    };
  }
}

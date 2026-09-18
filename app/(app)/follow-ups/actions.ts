"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";
import { recomputeQuoteFollowUpState, skipRemindersCoveredBy } from "@/lib/quote-state";
import { requestToday } from "@/lib/request-time";
import type { ActionResult } from "@/lib/types";

type ReminderStatus = "pending" | "completed" | "skipped";

/** Quote statuses whose reminders are closed for good, as the user sees them. */
const CLOSED_LABELS: Record<string, string> = { accepted: "won", rejected: "lost", expired: "expired" };

function revalidateViews() {
  revalidatePath("/follow-ups");
  revalidatePath("/quotes");
  revalidatePath("/dashboard");
}

/** Why a reminder can't move to `next` from where it already is. */
function alreadyMessage(current: string): string {
  return current === "completed"
    ? "This follow-up was already completed, maybe in another tab."
    : current === "skipped"
      ? "This reminder was already skipped: a follow-up you recorded covered it, or it was skipped in another tab."
      : "This reminder is still open.";
}

async function setFollowUpStatus(id: string, status: ReminderStatus): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  try {
    const { data: fu, error } = await supabase
      .from("follow_ups")
      .select("id, quote_id, status, quote:quotes(status)")
      .eq("id", String(id ?? ""))
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!fu) {
      return { ok: false, error: "This reminder no longer exists. Its quote may have been deleted." };
    }
    // Already in that state before this press (done in another tab, a page
    // left open): say so, don't reset completed_at, and refresh the stale page.
    if (fu.status === status) {
      revalidateViews();
      return { ok: false, error: alreadyMessage(fu.status) };
    }

    // A won, lost or expired quote has no open reminders; reopening one would
    // show a closed quote as due on the dashboard and Follow-ups page.
    const quote = (Array.isArray(fu.quote) ? fu.quote[0] : fu.quote) as { status?: string } | null;
    const closedAs = CLOSED_LABELS[quote?.status ?? ""];
    if (status === "pending" && closedAs) {
      return {
        ok: false,
        error: `This quote is marked ${closedAs}, so its reminders stay closed. To follow up again, use “Reopen as sent” on the quote.`,
      };
    }

    // Done and Skip only apply to a reminder that is still open, and Reopen to
    // one that isn't. A stale page must not turn a reminder that a follow-up
    // already covered into a second recorded follow-up.
    const allowedFrom: ReminderStatus[] = status === "pending" ? ["completed", "skipped"] : ["pending"];
    if (!allowedFrom.includes(fu.status as ReminderStatus)) {
      revalidateViews();
      return { ok: false, error: alreadyMessage(fu.status) };
    }

    const { data: updated, error: updateError } = await supabase
      .from("follow_ups")
      .update({
        status,
        completed_at: status === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", fu.id)
      .eq("user_id", user.id)
      .eq("status", fu.status)
      .select("id");
    if (updateError) throw new Error(updateError.message);
    if (!updated?.length) {
      // Changed between the read and the write. A second click or tab doing
      // the same thing is fine; anything else is worth saying.
      const { data: now } = await supabase
        .from("follow_ups")
        .select("status")
        .eq("id", fu.id)
        .eq("user_id", user.id)
        .maybeSingle();
      revalidateViews();
      if (now?.status === status) return { ok: true };
      return { ok: false, error: now ? alreadyMessage(now.status) : "This reminder no longer exists. Its quote may have been deleted." };
    }

    // Following up today also covers the quote's other reminders already due.
    if (status === "completed") {
      await skipRemindersCoveredBy(supabase, user.id, fu.quote_id, fu.id, await requestToday());
    }
    await recomputeQuoteFollowUpState(supabase, user.id, fu.quote_id);
  } catch (e) {
    console.error("[follow-ups] updating a reminder failed:", e instanceof Error ? e.message : e);
    revalidateViews();
    return { ok: false, error: "The reminder couldn't be updated just now. Please try again." };
  }

  revalidateViews();
  return { ok: true };
}

export async function completeFollowUp(id: string): Promise<ActionResult> {
  return setFollowUpStatus(id, "completed");
}

export async function skipFollowUp(id: string): Promise<ActionResult> {
  return setFollowUpStatus(id, "skipped");
}

export async function reopenFollowUp(id: string): Promise<ActionResult> {
  return setFollowUpStatus(id, "pending");
}

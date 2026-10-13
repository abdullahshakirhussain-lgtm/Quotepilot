"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";
import { recomputeQuoteFollowUpState, skipRemindersCoveredBy } from "@/lib/quote-state";
import { requestToday } from "@/lib/request-time";
import { addDays } from "@/lib/utils";
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
      .select("id, quote_id, status, due_date, quote:quotes(status)")
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
    // Skipping a due reminder skips them too: the lists show one row per quote
    // for everything due, so skipping that row must clear the whole stack.
    const today = await requestToday();
    if (status === "completed" || (status === "skipped" && String(fu.due_date) <= today)) {
      await skipRemindersCoveredBy(supabase, user.id, fu.quote_id, fu.id, today);
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

/** How far a reminder can be pushed back in one go. */
const SNOOZE_DAYS = [1, 3, 7, 14] as const;

/**
 * Moves one open reminder to a later day ("they asked me to call back next
 * week"). Counted from today, or from its own date if that is later. Any of
 * the quote's other reminders that are already due move with it, since the
 * lists show them as a single row.
 */
export async function snoozeFollowUp(id: string, days: number): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  if (!(SNOOZE_DAYS as readonly number[]).includes(days)) {
    return { ok: false, error: "Choose how long to snooze this reminder." };
  }

  try {
    const { data: fu, error } = await supabase
      .from("follow_ups")
      .select("id, quote_id, status, due_date")
      .eq("id", String(id ?? ""))
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!fu) return { ok: false, error: "This reminder no longer exists. Its quote may have been deleted." };
    if (fu.status !== "pending") {
      revalidateViews();
      return { ok: false, error: alreadyMessage(fu.status) };
    }

    const today = await requestToday();
    const from = String(fu.due_date) > today ? String(fu.due_date) : today;
    const next = addDays(from, days);

    const { data: moved, error: updateError } = await supabase
      .from("follow_ups")
      .update({ due_date: next })
      .eq("id", fu.id)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .select("id");
    if (updateError) throw new Error(updateError.message);
    if (!moved?.length) {
      revalidateViews();
      return { ok: false, error: "This reminder changed in another tab. Refresh the page and try again." };
    }
    // Other reminders for the quote that were already due are covered by this one.
    if (String(fu.due_date) <= today) {
      await skipRemindersCoveredBy(supabase, user.id, fu.quote_id, fu.id, today);
    }
    await recomputeQuoteFollowUpState(supabase, user.id, fu.quote_id);
  } catch (e) {
    console.error("[follow-ups] snoozing a reminder failed:", e instanceof Error ? e.message : e);
    revalidateViews();
    return { ok: false, error: "The reminder couldn't be moved just now. Please try again." };
  }

  revalidateViews();
  return { ok: true };
}

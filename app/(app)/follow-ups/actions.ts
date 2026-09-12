"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

function revalidateViews() {
  revalidatePath("/follow-ups");
  revalidatePath("/quotes");
  revalidatePath("/dashboard");
}

/**
 * Recomputes a quote's follow-up bookkeeping from its follow_ups rows so the
 * quote card and dashboard stay accurate no matter how reminders change.
 */
async function recomputeQuoteState(
  supabase: SupabaseClient,
  userId: string,
  quoteId: string
) {
  const { data: rows } = await supabase
    .from("follow_ups")
    .select("status, due_date, completed_at")
    .eq("quote_id", quoteId)
    .eq("user_id", userId);

  const list = rows ?? [];
  const completed = list.filter((r) => r.status === "completed");
  const pending = list
    .filter((r) => r.status === "pending")
    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1));

  const lastCompletedAt = completed
    .map((r) => r.completed_at)
    .filter(Boolean)
    .sort()
    .pop();

  await supabase
    .from("quotes")
    .update({
      follow_up_count: completed.length,
      last_follow_up_at: lastCompletedAt ?? null,
      next_follow_up_at: pending[0] ? pending[0].due_date + "T09:00:00Z" : null,
    })
    .eq("id", quoteId)
    .eq("user_id", userId);
}

async function setFollowUpStatus(
  id: string,
  status: "pending" | "completed" | "skipped"
) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const { data: fu } = await supabase
    .from("follow_ups")
    .select("id, quote_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!fu) return;

  await supabase
    .from("follow_ups")
    .update({
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  await recomputeQuoteState(supabase, user.id, fu.quote_id);
  revalidateViews();
}

export async function completeFollowUp(id: string): Promise<void> {
  await setFollowUpStatus(id, "completed");
}

export async function skipFollowUp(id: string): Promise<void> {
  await setFollowUpStatus(id, "skipped");
}

export async function reopenFollowUp(id: string): Promise<void> {
  await setFollowUpStatus(id, "pending");
}

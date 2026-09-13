"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";
import { recomputeQuoteFollowUpState } from "@/lib/quote-state";

function revalidateViews() {
  revalidatePath("/follow-ups");
  revalidatePath("/quotes");
  revalidatePath("/dashboard");
}

async function setFollowUpStatus(
  id: string,
  status: "pending" | "completed" | "skipped"
) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: fu, error } = await supabase
    .from("follow_ups")
    .select("id, quote_id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  // Already in that state (e.g. a double click): don't reset completed_at.
  if (!fu || fu.status === status) return;

  const { error: updateError } = await supabase
    .from("follow_ups")
    .update({
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (updateError) throw new Error(updateError.message);

  await recomputeQuoteFollowUpState(supabase, user.id, fu.quote_id);
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

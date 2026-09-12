import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { FollowUpsClient } from "@/components/follow-ups/FollowUpsClient";
import type { FollowUpWithContext } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("follow_ups")
    .select(
      "*, quote:quotes(id, title, amount, currency, status), lead:leads(id, customer_name, company_name)"
    )
    .eq("user_id", user!.id)
    .order("due_date", { ascending: true });

  const followUps: FollowUpWithContext[] = (data ?? []).map((f) => ({
    ...(f as FollowUpWithContext),
    quote: Array.isArray(f.quote) ? (f.quote[0] ?? null) : (f.quote ?? null),
    lead: Array.isArray(f.lead) ? (f.lead[0] ?? null) : (f.lead ?? null),
  }));

  return <FollowUpsClient followUps={followUps} />;
}

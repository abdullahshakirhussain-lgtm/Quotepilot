import { createClient, requireUser } from "@/lib/supabase/server";
import { FollowUpsClient } from "@/components/follow-ups/FollowUpsClient";
import { requestToday } from "@/lib/request-time";
import { emailConfig } from "@/lib/email";
import type { FollowUpWithContext } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("follow_ups")
    .select(
      "*, quote:quotes(id, title, amount, currency, status, follow_up_count, valid_until, next_follow_up_at), lead:leads(id, customer_name, company_name, email)"
    )
    .eq("user_id", user.id)
    .order("due_date", { ascending: true });

  if (error) throw new Error(`Could not load follow-ups: ${error.message}`);

  const followUps: FollowUpWithContext[] = (data ?? []).map((f) => ({
    ...(f as FollowUpWithContext),
    quote: Array.isArray(f.quote) ? (f.quote[0] ?? null) : (f.quote ?? null),
    lead: Array.isArray(f.lead) ? (f.lead[0] ?? null) : (f.lead ?? null),
  }));

  // "Today" comes from the server (same value the dashboard uses), so the two
  // pages always agree and SSR matches the browser.
  return (
    <FollowUpsClient
      followUps={followUps}
      today={await requestToday()}
      emailEnabled={emailConfig() !== null}
    />
  );
}

import { createClient, requireUser } from "@/lib/supabase/server";
import { FollowUpsClient } from "@/components/follow-ups/FollowUpsClient";
import { requestToday } from "@/lib/request-time";
import { emailConfig } from "@/lib/email";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { FollowUpWithContext } from "@/lib/types";

export const dynamic = "force-dynamic";

const SELECT =
  "*, quote:quotes(id, title, amount, currency, status, follow_up_count, valid_until, next_follow_up_at), lead:leads(id, customer_name, company_name, email)";

/** How much finished history the page lists; the CSV export has all of it. */
const DONE_SHOWN = 200;

export default async function FollowUpsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  // Every open reminder, however many; finished ones are history, so only the
  // latest are listed. (Reading all rows in one request would silently stop at
  // the API's row cap and drop the newest reminders.)
  const [pending, doneRes] = await Promise.all([
    fetchAllRows<FollowUpWithContext>((from, to) =>
      supabase
        .from("follow_ups")
        .select(SELECT)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("due_date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    ),
    supabase
      .from("follow_ups")
      .select(SELECT)
      .eq("user_id", user.id)
      .neq("status", "pending")
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(DONE_SHOWN + 1),
  ]);
  if (doneRes.error) throw new Error(`Could not load follow-ups: ${doneRes.error.message}`);

  const done = (doneRes.data ?? []) as FollowUpWithContext[];
  const followUps: FollowUpWithContext[] = [...pending, ...done.slice(0, DONE_SHOWN)].map((f) => ({
    ...f,
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
      moreDone={done.length > DONE_SHOWN}
    />
  );
}

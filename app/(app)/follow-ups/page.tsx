import { createClient, requireUser } from "@/lib/supabase/server";
import { recordVisit } from "@/lib/visits-server";
import { FollowUpsClient } from "@/components/follow-ups/FollowUpsClient";
import { requestToday } from "@/lib/request-time";
import { emailConfig } from "@/lib/email";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { FollowUpWithContext } from "@/lib/types";
import { latestReplies } from "@/lib/replies-server";

export const dynamic = "force-dynamic";

const SELECT =
  "*, quote:quotes(id, title, amount, currency, status, follow_up_count, valid_until, next_follow_up_at), lead:leads(id, customer_name, company_name, email)";

/** How much finished history the page lists; the CSV export has all of it. */
const DONE_SHOWN = 200;

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ quote?: string | string[] }>;
}) {
  const user = await requireUser();
  // This visit, for QuoteLoop's own analytics: runs alongside the queries below.
  const visit = recordVisit("/follow-ups");
  // "View follow-ups" on a quote opens this page showing just that quote.
  const quoteParam = (await searchParams).quote;
  const quoteId = (Array.isArray(quoteParam) ? quoteParam[0] : quoteParam) ?? null;
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
      // Reminders paused because the customer replied aren't history: the
      // reply is shown on top instead.
      .eq("paused_by_reply", false)
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

  // Open quotes whose customer replied: on top, with what they wrote.
  const { data: repliedRows, error: repliedError } = await supabase
    .from("quotes")
    .select("id, title, customer_replied_at, lead:leads(customer_name)")
    .eq("user_id", user.id)
    .not("customer_replied_at", "is", null)
    .in("status", ["sent", "follow_up_due", "negotiating"])
    .order("customer_replied_at", { ascending: false })
    .limit(20);
  if (repliedError) console.error("[follow-ups] replied quotes unavailable:", repliedError.message);
  const replyText = await latestReplies(supabase, user.id, (repliedRows ?? []).map((q) => q.id as string));
  const replied = (repliedRows ?? []).map((q) => {
    const lead = Array.isArray(q.lead) ? q.lead[0] : q.lead;
    return {
      quoteId: q.id as string,
      title: q.title as string,
      customerName: (lead as { customer_name?: string } | null)?.customer_name ?? "Customer",
      repliedAt: q.customer_replied_at as string,
      snippet: replyText[q.id as string]?.text ?? "",
    };
  });

  // "Today" comes from the server (same value the dashboard uses), so the two
  // pages always agree and SSR matches the browser.
  await visit;
  return (
    <FollowUpsClient
      followUps={followUps}
      today={await requestToday()}
      emailEnabled={emailConfig() !== null}
      moreDone={done.length > DONE_SHOWN}
      quoteId={quoteId}
      replied={replied}
    />
  );
}

import { createClient, requireUser } from "@/lib/supabase/server";
import { recordVisit } from "@/lib/visits-server";
import { DashboardView, type RepliedQuote } from "@/components/dashboard/DashboardView";
import { currentHour, todayISO } from "@/lib/utils";
import { computeDashboardMetrics, currencyCounts, inCurrency, openByAge } from "@/lib/metrics";
import { latestReplies } from "@/lib/replies-server";
import { loadDashboardExtras } from "@/lib/dashboard-extras";
import { classifyFollowUp, onePerQuote } from "@/lib/follow-up-state";
import { getRequestTimeZone } from "@/lib/request-time";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { isSampleAddress } from "@/lib/email-address";
import type { Business, FollowUpWithContext } from "@/lib/types";

export const dynamic = "force-dynamic";

const FOLLOW_UP_SELECT =
  "*, quote:quotes(id, title, amount, currency, status, follow_up_count, valid_until, next_follow_up_at), lead:leads(id, customer_name, company_name, email)";

export default async function DashboardPage(props: { searchParams?: Promise<{ currency?: string }> }) {
  // ?currency=GBP: the overview shows one currency at a time. Optional, so
  // test harnesses can call the page without props.
  const asked = ((await props?.searchParams)?.currency ?? "").toUpperCase();
  const user = await requireUser();
  // This visit, for QuoteLoop's own analytics: runs alongside the queries below.
  const visit = recordVisit("/dashboard");
  const supabase = await createClient();
  // The viewer's own local day (browser zone → APP_TIMEZONE fallback → UTC).
  const timeZone = await getRequestTimeZone();
  const today = todayISO(timeZone);

  // Every row, not just the API's first page: these feed totals and counts.
  // A failed query throws, and is never rendered as zeros — that would read as
  // "you lost your data".
  const [businessRes, leads, quotes, followUps, repliedRes, extras] = await Promise.all([
    supabase.from("businesses").select("*").eq("user_id", user.id).maybeSingle<Business>(),
    fetchAllRows<{ status: string; email: string | null }>((from, to) =>
      supabase.from("leads").select("status, email").eq("user_id", user.id).order("id").range(from, to)
    ),
    fetchAllRows<{ status: string; amount: number; currency: string; quote_date: string | null; created_at: string }>((from, to) =>
      supabase.from("quotes").select("status, amount, currency, quote_date, created_at").eq("user_id", user.id).order("id").range(from, to)
    ),
    fetchAllRows<FollowUpWithContext>((from, to) =>
      supabase
        .from("follow_ups")
        .select(FOLLOW_UP_SELECT)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("due_date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    ),
    // Open quotes whose customer replied: reminders are paused until answered.
    supabase
      .from("quotes")
      .select("id, title, customer_replied_at, lead:leads(customer_name)")
      .eq("user_id", user.id)
      .not("customer_replied_at", "is", null)
      .in("status", ["sent", "follow_up_due", "negotiating"])
      .order("customer_replied_at", { ascending: false })
      .limit(10),
    // This week's progress, wins this month, and the latest things that happened.
    loadDashboardExtras(supabase, user.id, today, timeZone),
  ]);
  // Optional: before the schema is re-run the column doesn't exist yet.
  if (repliedRes.error) console.error("[dashboard] replied quotes unavailable:", repliedRes.error.message);
  const repliedRows = repliedRes.error ? [] : (repliedRes.data ?? []);
  const replyText = await latestReplies(supabase, user.id, repliedRows.map((q) => q.id as string));
  const replied: RepliedQuote[] = repliedRows.map((q) => {
    const lead = Array.isArray(q.lead) ? (q.lead[0] ?? null) : q.lead;
    return {
      id: q.id as string,
      title: q.title as string,
      repliedAt: q.customer_replied_at as string,
      customerName: (lead as { customer_name?: string } | null)?.customer_name ?? "Customer",
      snippet: replyText[q.id as string]?.text ?? "",
    };
  });
  if (businessRes.error) throw new Error(`Could not load dashboard: ${businessRes.error.message}`);
  const business = businessRes.data;
  const currency = business?.currency ?? "USD";
  const pending: FollowUpWithContext[] = followUps.map((f) => ({
    ...f,
    quote: Array.isArray(f.quote) ? (f.quote[0] ?? null) : (f.quote ?? null),
    lead: Array.isArray(f.lead) ? (f.lead[0] ?? null) : (f.lead ?? null),
  }));

  // One row per quote for what's due: a quote's missed reminders are one job.
  const perQuote = onePerQuote(pending, today);
  const due = perQuote.filter((f) => classifyFollowUp(f, today) !== "upcoming");
  // Amounts in different currencies are never added together or converted:
  // the overview shows one currency, the business's own unless another is chosen.
  const currencies = currencyCounts(quotes, currency);
  const shown = currencies.find((c) => c.currency === asked)?.currency ?? currencies[0]?.currency ?? currency;
  const shownQuotes = currencies.length > 1 ? inCurrency(quotes, shown, currency) : quotes;
  const m = computeDashboardMetrics({
    leads,
    quotes: shownQuotes,
    followUps: due,
    today,
    currency: shown,
  });

  await visit;
  return (
    <DashboardView
      m={m}
      currency={shown}
      currencies={currencies}
      today={today}
      greeting={greeting(currentHour(timeZone))}
      firstName={(business?.owner_name || "").split(" ")[0]}
      attention={due}
      upcoming={perQuote.filter((f) => classifyFollowUp(f, today) === "upcoming").slice(0, 5)}
      hasData={leads.length > 0 || quotes.length > 0}
      hasSampleData={leads.some((l) => isSampleAddress(l.email))}
      replied={replied}
      weeks={extras.weeks}
      ages={openByAge(shownQuotes, today)}
      followedUpOnce={extras.followedUpOnce}
      wins={extras.wins ? (extras.wins[shown] ?? { thisMonth: 0, lastMonth: 0 }) : null}
      recent={extras.recent}
      timeZone={timeZone}
    />
  );
}

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

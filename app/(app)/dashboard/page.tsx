import { createClient, requireUser } from "@/lib/supabase/server";
import { DashboardView, type RepliedQuote } from "@/components/dashboard/DashboardView";
import { currentHour, todayISO } from "@/lib/utils";
import { computeDashboardMetrics, currencyCounts, inCurrency } from "@/lib/metrics";
import { classifyFollowUp, onePerQuote } from "@/lib/follow-up-state";
import { getRequestTimeZone } from "@/lib/request-time";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { isSampleAddress } from "@/lib/email-address";
import type { Business, FollowUpWithContext } from "@/lib/types";
import type { QuoteStatus } from "@/lib/constants";
import type { LatestQuote } from "@/components/dashboard/DashboardView";

export const dynamic = "force-dynamic";

/** How many of the newest quotes the dashboard lists. */
const LATEST_SHOWN = 8;

const FOLLOW_UP_SELECT =
  "*, quote:quotes(id, title, amount, currency, status, follow_up_count, valid_until, next_follow_up_at), lead:leads(id, customer_name, company_name, email)";

export default async function DashboardPage(props: { searchParams?: Promise<{ currency?: string }> }) {
  // ?currency=GBP: the overview shows one currency at a time. Optional, so
  // test harnesses can call the page without props.
  const asked = ((await props?.searchParams)?.currency ?? "").toUpperCase();
  const user = await requireUser();
  const supabase = await createClient();
  // The viewer's own local day (browser zone → APP_TIMEZONE fallback → UTC).
  const timeZone = await getRequestTimeZone();
  const today = todayISO(timeZone);

  // Every row, not just the API's first page: these feed totals and counts.
  // A failed query throws, and is never rendered as zeros — that would read as
  // "you lost your data".
  const [businessRes, leads, quotes, followUps, latestRes, repliedRes] = await Promise.all([
    supabase.from("businesses").select("*").eq("user_id", user.id).maybeSingle<Business>(),
    fetchAllRows<{ status: string; email: string | null }>((from, to) =>
      supabase.from("leads").select("status, email").eq("user_id", user.id).order("id").range(from, to)
    ),
    fetchAllRows<{ status: string; amount: number; currency: string }>((from, to) =>
      supabase.from("quotes").select("status, amount, currency").eq("user_id", user.id).order("id").range(from, to)
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
    // The newest quotes, for the list at the bottom of the dashboard.
    supabase
      .from("quotes")
      .select("id, title, amount, currency, status, quote_date, lead:leads(customer_name, company_name, email)")
      .eq("user_id", user.id)
      .order("quote_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(LATEST_SHOWN),
    // Open quotes whose customer replied: reminders are paused until answered.
    supabase
      .from("quotes")
      .select("id, title, customer_replied_at, lead:leads(customer_name)")
      .eq("user_id", user.id)
      .not("customer_replied_at", "is", null)
      .in("status", ["sent", "follow_up_due", "negotiating"])
      .order("customer_replied_at", { ascending: false })
      .limit(10),
  ]);
  // Optional: before the schema is re-run the column doesn't exist yet.
  if (repliedRes.error) console.error("[dashboard] replied quotes unavailable:", repliedRes.error.message);
  const replied: RepliedQuote[] = (repliedRes.error ? [] : (repliedRes.data ?? [])).map((q) => {
    const lead = Array.isArray(q.lead) ? (q.lead[0] ?? null) : q.lead;
    return {
      id: q.id as string,
      title: q.title as string,
      repliedAt: q.customer_replied_at as string,
      customerName: (lead as { customer_name?: string } | null)?.customer_name ?? "Customer",
    };
  });
  if (businessRes.error) throw new Error(`Could not load dashboard: ${businessRes.error.message}`);
  if (latestRes.error) throw new Error(`Could not load dashboard: ${latestRes.error.message}`);
  const latest: LatestQuote[] = (latestRes.data ?? []).map((q) => {
    const lead = Array.isArray(q.lead) ? (q.lead[0] ?? null) : q.lead;
    return {
      id: q.id as string,
      title: q.title as string,
      amount: Number(q.amount),
      currency: q.currency as string,
      status: q.status as QuoteStatus,
      quoteDate: q.quote_date as string,
      customerName: lead?.customer_name ?? "Customer",
      companyName: lead?.company_name ?? null,
      sample: isSampleAddress(lead?.email),
    };
  });

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
  const m = computeDashboardMetrics({
    leads,
    quotes: currencies.length > 1 ? inCurrency(quotes, shown, currency) : quotes,
    followUps: due,
    today,
    currency: shown,
  });

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
      customers={leads.length}
      latest={latest}
      replied={replied}
    />
  );
}

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

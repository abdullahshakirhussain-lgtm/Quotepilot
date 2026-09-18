import { createClient, requireUser } from "@/lib/supabase/server";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { currentHour, todayISO } from "@/lib/utils";
import { computeDashboardMetrics } from "@/lib/metrics";
import { classifyFollowUp } from "@/lib/follow-up-state";
import { getRequestTimeZone } from "@/lib/request-time";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { Business, FollowUpWithContext } from "@/lib/types";

export const dynamic = "force-dynamic";

const FOLLOW_UP_SELECT =
  "*, quote:quotes(id, title, amount, currency, status, follow_up_count, valid_until, next_follow_up_at), lead:leads(id, customer_name, company_name)";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  // The viewer's own local day (browser zone → APP_TIMEZONE fallback → UTC).
  const timeZone = await getRequestTimeZone();
  const today = todayISO(timeZone);

  // Every row, not just the API's first page: these feed totals and counts.
  // A failed query throws, and is never rendered as zeros — that would read as
  // "you lost your data".
  const [businessRes, leads, quotes, followUps] = await Promise.all([
    supabase.from("businesses").select("*").eq("user_id", user.id).maybeSingle<Business>(),
    fetchAllRows<{ status: string }>((from, to) =>
      supabase.from("leads").select("status").eq("user_id", user.id).order("id").range(from, to)
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
  ]);
  if (businessRes.error) throw new Error(`Could not load dashboard: ${businessRes.error.message}`);

  const business = businessRes.data;
  const currency = business?.currency ?? "USD";
  const pending: FollowUpWithContext[] = followUps.map((f) => ({
    ...f,
    quote: Array.isArray(f.quote) ? (f.quote[0] ?? null) : (f.quote ?? null),
    lead: Array.isArray(f.lead) ? (f.lead[0] ?? null) : (f.lead ?? null),
  }));

  const m = computeDashboardMetrics({ leads, quotes, followUps: pending, today, currency });

  return (
    <DashboardView
      m={m}
      currency={currency}
      today={today}
      greeting={greeting(currentHour(timeZone))}
      firstName={(business?.owner_name || "").split(" ")[0]}
      attention={pending.filter((f) => classifyFollowUp(f, today) !== "upcoming")}
      upcoming={pending.filter((f) => classifyFollowUp(f, today) === "upcoming").slice(0, 5)}
      hasData={leads.length > 0 || quotes.length > 0}
    />
  );
}

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

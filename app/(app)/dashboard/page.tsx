import { createClient, requireUser } from "@/lib/supabase/server";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { currentHour, todayISO } from "@/lib/utils";
import { computeDashboardMetrics } from "@/lib/metrics";
import { classifyFollowUp } from "@/lib/follow-up-state";
import { getRequestTimeZone } from "@/lib/request-time";
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

  const [businessRes, leadsRes, quotesRes, followUpsRes] = await Promise.all([
    supabase.from("businesses").select("*").eq("user_id", user.id).maybeSingle<Business>(),
    supabase.from("leads").select("status").eq("user_id", user.id),
    supabase.from("quotes").select("status, amount").eq("user_id", user.id),
    supabase
      .from("follow_ups")
      .select(FOLLOW_UP_SELECT)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("due_date", { ascending: true }),
  ]);

  // Never render a failed query as zeros — that reads as "you lost your data".
  const failed = [businessRes, leadsRes, quotesRes, followUpsRes].find((r) => r.error);
  if (failed?.error) throw new Error(`Could not load dashboard: ${failed.error.message}`);

  const business = businessRes.data;
  const pending: FollowUpWithContext[] = (followUpsRes.data ?? []).map((f) => ({
    ...(f as FollowUpWithContext),
    quote: Array.isArray(f.quote) ? (f.quote[0] ?? null) : (f.quote ?? null),
    lead: Array.isArray(f.lead) ? (f.lead[0] ?? null) : (f.lead ?? null),
  }));

  const m = computeDashboardMetrics({
    leads: leadsRes.data ?? [],
    quotes: quotesRes.data ?? [],
    followUps: pending,
    today,
  });

  return (
    <DashboardView
      m={m}
      currency={business?.currency ?? "USD"}
      today={today}
      greeting={greeting(currentHour(timeZone))}
      firstName={(business?.owner_name || "").split(" ")[0]}
      attention={pending.filter((f) => classifyFollowUp(f, today) !== "upcoming")}
      upcoming={pending.filter((f) => classifyFollowUp(f, today) === "upcoming").slice(0, 5)}
      hasData={(leadsRes.data ?? []).length > 0 || (quotesRes.data ?? []).length > 0}
    />
  );
}

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

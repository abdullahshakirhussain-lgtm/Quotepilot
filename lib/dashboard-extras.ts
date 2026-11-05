// The dashboard's progress and activity: this week's follow-ups, wins this
// month against last, and the latest things that happened. Each part is
// optional: a failed or not-yet-available read leaves that part out, never
// the whole dashboard.
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, dateInZone } from "@/lib/utils";

export interface WeekProgress {
  /** Follow-ups due this week (Monday to Sunday) that were done. */
  done: number;
  /** Follow-ups due this week that are done or still to do (skipped ones don't count). */
  total: number;
}

export interface Wins {
  thisMonth: number;
  lastMonth: number;
}

export interface RecentItem {
  at: string;
  text: string;
  /** An update under the bell not seen yet. */
  unread?: boolean;
}

export interface DashboardExtras {
  week: WeekProgress | null;
  /** At least one follow-up was ever done: the account is past getting started. */
  followedUpOnce: boolean;
  /** Per currency (never added across currencies); null until the database records when quotes are won or lost. */
  wins: Record<string, Wins> | null;
  recent: RecentItem[];
}

const RECENT = 5;

const nameOf = (lead: unknown): string => {
  const l = Array.isArray(lead) ? lead[0] : lead;
  return ((l as { customer_name?: string } | null)?.customer_name ?? "").trim() || "a customer";
};

/** Monday (YYYY-MM-DD) of the week holding `today`. */
export function weekStartOf(today: string): string {
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(today, -weekday);
}

/** The first day (YYYY-MM-DD) of the month before the one holding `today`. */
export function previousMonthStart(today: string): string {
  const [y, m] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
}

export async function loadDashboardExtras(
  supabase: SupabaseClient,
  userId: string,
  today: string,
  timeZone: string
): Promise<DashboardExtras> {
  const weekStart = weekStartOf(today);
  const weekEnd = addDays(weekStart, 6);
  const monthStart = `${today.slice(0, 7)}-01`;
  const prevStart = previousMonthStart(today);
  // A day early, so a win late on the last day of the month before (in any time zone) is in range.
  const decidedSince = `${addDays(prevStart, -1)}T00:00:00Z`;

  const [weekRes, everRes, decidedRes, notesRes, emailsRes, addedRes] = await Promise.all([
    supabase
      .from("follow_ups")
      .select("status")
      .eq("user_id", userId)
      .gte("due_date", weekStart)
      .lte("due_date", weekEnd)
      .in("status", ["pending", "completed"])
      .limit(1000),
    supabase.from("follow_ups").select("id").eq("user_id", userId).eq("status", "completed").limit(1),
    supabase
      .from("quotes")
      .select("status, amount, currency, decided_at, lead:leads(customer_name)")
      .eq("user_id", userId)
      .in("status", ["accepted", "rejected"])
      .gte("decided_at", decidedSince)
      .order("decided_at", { ascending: false })
      .limit(500),
    supabase.from("notifications").select("title, created_at, read_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(RECENT),
    supabase
      .from("email_logs")
      .select("created_at, sent_at, lead:leads(customer_name)")
      .eq("user_id", userId)
      .eq("status", "sent")
      .order("created_at", { ascending: false })
      .limit(RECENT),
    supabase.from("quotes").select("created_at, lead:leads(customer_name)").eq("user_id", userId).order("created_at", { ascending: false }).limit(RECENT),
  ]);

  for (const [name, r] of [["week", weekRes], ["first follow-up", everRes], ["wins", decidedRes], ["updates", notesRes], ["emails", emailsRes], ["quotes", addedRes]] as const) {
    if (r.error) console.error(`[dashboard] ${name} unavailable:`, r.error.message);
  }

  const weekRows = (weekRes.data ?? []) as { status: string }[];
  const week = weekRes.error ? null : { done: weekRows.filter((r) => r.status === "completed").length, total: weekRows.length };

  // Wins per currency: amounts in different currencies are never added.
  let wins: Record<string, Wins> | null = null;
  const decided = (decidedRes.data ?? []) as { status: string; amount: number; currency: string | null; decided_at: string | null; lead: unknown }[];
  if (!decidedRes.error) {
    const out: Record<string, Wins> = {};
    for (const q of decided) {
      if (q.status !== "accepted" || !q.decided_at) continue;
      const code = (q.currency || "USD").toUpperCase();
      const w = (out[code] ??= { thisMonth: 0, lastMonth: 0 });
      const day = dateInZone(q.decided_at, timeZone);
      if (day >= monthStart) w.thisMonth += Number(q.amount) || 0;
      else if (day >= prevStart) w.lastMonth += Number(q.amount) || 0;
    }
    for (const w of Object.values(out)) {
      w.thisMonth = Math.round(w.thisMonth * 100) / 100;
      w.lastMonth = Math.round(w.lastMonth * 100) / 100;
    }
    wins = out;
  }

  const merged: RecentItem[] = [
    ...((notesRes.data ?? []) as { title: string; created_at: string; read_at: string | null }[]).map((n) => ({
      at: n.created_at,
      text: n.title,
      unread: !n.read_at,
    })),
    ...((emailsRes.data ?? []) as { created_at: string; sent_at: string | null; lead: unknown }[]).map((e) => ({
      at: e.sent_at ?? e.created_at,
      text: `You emailed ${nameOf(e.lead)}`,
    })),
    ...decided
      .filter((q) => q.decided_at)
      .slice(0, RECENT)
      .map((q) => ({ at: q.decided_at as string, text: `${nameOf(q.lead)}'s quote marked ${q.status === "accepted" ? "won" : "lost"}` })),
    ...((addedRes.data ?? []) as { created_at: string; lead: unknown }[]).map((q) => ({
      at: q.created_at,
      text: `Quote added for ${nameOf(q.lead)}`,
    })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  // The same thing several times (four quotes added for one customer) is one
  // line with a count, so it can't push everything else off the list.
  const byText = new Map<string, RecentItem & { count: number }>();
  for (const item of merged) {
    const seen = byText.get(item.text);
    if (seen) {
      seen.count++;
      seen.unread = seen.unread || item.unread;
    } else byText.set(item.text, { ...item, count: 1 });
  }
  const recent: RecentItem[] = [...byText.values()]
    .slice(0, RECENT)
    .map(({ count, ...item }) => (count > 1 ? { ...item, text: `${item.text} (${count} times)` } : item));

  return { week, followedUpOnce: (everRes.data ?? []).length > 0, wins, recent };
}

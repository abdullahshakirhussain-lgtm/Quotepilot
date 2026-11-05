// The dashboard's progress and activity: follow-ups done week by week, wins
// this month against last, and the latest things that happened. Each part is
// optional: a failed or not-yet-available read leaves that part out, never
// the whole dashboard.
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, dateInZone } from "@/lib/utils";

/** Follow-ups done in one week (Monday to Sunday, in the viewer's time zone). */
export interface WeekCount {
  /** The Monday, YYYY-MM-DD. */
  start: string;
  count: number;
}

/** How many weeks the chart shows, this one last. */
export const WEEKS_SHOWN = 8;

export interface Wins {
  thisMonth: number;
  lastMonth: number;
}

export interface RecentItem {
  at: string;
  text: string;
  /** An update under the bell not seen yet. */
  unread?: boolean;
  /** The quote it's about, opened when the line is clicked. */
  quoteId?: string;
  /** Somewhere else it leads (billing), when it isn't about a quote. */
  href?: string;
  /** A customer's reply (or automatic reply), which the dashboard may already show above. */
  reply?: boolean;
}

export interface DashboardExtras {
  /** Oldest first, this week last; null when it couldn't be read. */
  weeks: WeekCount[] | null;
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
  const starts = Array.from({ length: WEEKS_SHOWN }, (_, i) => addDays(weekStart, -7 * (WEEKS_SHOWN - 1 - i)));
  // A day early, so a follow-up late on that Sunday (in any time zone) is in range.
  const doneSince = `${addDays(starts[0], -1)}T00:00:00Z`;
  const monthStart = `${today.slice(0, 7)}-01`;
  const prevStart = previousMonthStart(today);
  // A day early, so a win late on the last day of the month before (in any time zone) is in range.
  const decidedSince = `${addDays(prevStart, -1)}T00:00:00Z`;

  const [weekRes, everRes, decidedRes, notesRes, emailsRes, addedRes] = await Promise.all([
    supabase
      .from("follow_ups")
      .select("completed_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("completed_at", doneSince)
      .limit(5000),
    supabase.from("follow_ups").select("id").eq("user_id", userId).eq("status", "completed").limit(1),
    supabase
      .from("quotes")
      .select("id, status, amount, currency, decided_at, lead:leads(customer_name)")
      .eq("user_id", userId)
      .in("status", ["accepted", "rejected"])
      .gte("decided_at", decidedSince)
      .order("decided_at", { ascending: false })
      .limit(500),
    supabase.from("notifications").select("kind, quote_id, title, created_at, read_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(RECENT),
    supabase
      .from("email_logs")
      .select("quote_id, created_at, sent_at, lead:leads(customer_name)")
      .eq("user_id", userId)
      .eq("status", "sent")
      .order("created_at", { ascending: false })
      .limit(RECENT),
    supabase.from("quotes").select("id, created_at, lead:leads(customer_name)").eq("user_id", userId).order("created_at", { ascending: false }).limit(RECENT),
  ]);

  for (const [name, r] of [["week", weekRes], ["first follow-up", everRes], ["wins", decidedRes], ["updates", notesRes], ["emails", emailsRes], ["quotes", addedRes]] as const) {
    if (r.error) console.error(`[dashboard] ${name} unavailable:`, r.error.message);
  }

  // Each follow-up in the week it was done, on the viewer's own calendar.
  let weeks: WeekCount[] | null = null;
  if (!weekRes.error) {
    const counts = new Map(starts.map((s) => [s, 0]));
    for (const r of (weekRes.data ?? []) as { completed_at: string | null }[]) {
      if (!r.completed_at) continue;
      const start = weekStartOf(dateInZone(r.completed_at, timeZone));
      if (counts.has(start)) counts.set(start, counts.get(start)! + 1);
    }
    weeks = starts.map((start) => ({ start, count: counts.get(start)! }));
  }

  // Wins per currency: amounts in different currencies are never added.
  let wins: Record<string, Wins> | null = null;
  const decided = (decidedRes.data ?? []) as { id: string; status: string; amount: number; currency: string | null; decided_at: string | null; lead: unknown }[];
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
    // Each line leads where the bell's would: its quote, or billing.
    ...((notesRes.data ?? []) as { kind: string; quote_id: string | null; title: string; created_at: string; read_at: string | null }[]).map((n) => ({
      at: n.created_at,
      text: n.title,
      unread: !n.read_at,
      quoteId: n.quote_id ?? undefined,
      href: !n.quote_id && (n.kind.startsWith("payment") || n.kind.startsWith("subscription")) ? "/settings?area=billing" : undefined,
      reply: n.kind === "customer_reply" || n.kind === "auto_reply" ? true : undefined,
    })),
    ...((emailsRes.data ?? []) as { quote_id: string | null; created_at: string; sent_at: string | null; lead: unknown }[]).map((e) => ({
      at: e.sent_at ?? e.created_at,
      text: `You emailed ${nameOf(e.lead)}`,
      quoteId: e.quote_id ?? undefined,
    })),
    ...decided
      .filter((q) => q.decided_at)
      .slice(0, RECENT)
      .map((q) => ({ at: q.decided_at as string, text: `Quote for ${nameOf(q.lead)} marked ${q.status === "accepted" ? "won" : "lost"}`, quoteId: q.id })),
    ...((addedRes.data ?? []) as { id: string; created_at: string; lead: unknown }[]).map((q) => ({
      at: q.created_at,
      text: `Quote added for ${nameOf(q.lead)}`,
      quoteId: q.id,
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
  // A few spare, so the dashboard can leave out what it already shows above.
  const recent: RecentItem[] = [...byText.values()]
    .slice(0, RECENT + 3)
    .map(({ count, ...item }) => (count > 1 ? { ...item, text: `${item.text} (${count} times)` } : item));

  return { weeks, followedUpOnce: (everRes.data ?? []).length > 0, wins, recent };
}

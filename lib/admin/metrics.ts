// The admin's figures, worked out from the rows in lib/admin/data.ts. Pure, so
// every number can be checked against known rows in the tests.
import { accessFrom } from "@/lib/billing";
import type { AdminData, AdminSubscriptionRow } from "./data";

const DAY = 86_400_000;

export const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/quotes": "Quotes",
  "/follow-ups": "Follow-ups",
  "/pipeline": "Pipeline",
  "/leads": "Customers",
  "/settings/business": "Settings: Business",
  "/settings/messages": "Settings: Messages",
  "/settings/billing": "Settings: Billing",
  "/settings/data": "Settings: Your data",
};
export const pageLabel = (path: string) => PAGE_LABELS[path] ?? path;

export type PlanState = "trial" | "paying" | "ending" | "payment_failed" | "expired" | "comped" | "none";
export const PLAN_LABELS: Record<PlanState, string> = {
  trial: "Trial",
  paying: "Paying",
  ending: "Cancelled, paid until",
  payment_failed: "Payment failed",
  expired: "Expired",
  comped: "Free (comped)",
  none: "No plan yet",
};

export function planOf(sub: AdminSubscriptionRow | undefined, now: Date): { state: PlanState; endsAt: string | null; daysLeft: number | null } {
  if (!sub) return { state: "none", endsAt: null, daysLeft: null };
  const a = accessFrom(sub, now);
  const state: PlanState =
    a.state === "trial"
      ? "trial"
      : a.state === "active"
        ? "paying"
        : a.state === "ending"
          ? "ending"
          : a.state === "grace"
            ? "payment_failed"
            : a.state === "expired"
              ? "expired"
              : a.state === "comped"
                ? "comped"
                : "none";
  return { state, endsAt: a.endsAt, daysLeft: a.daysLeft };
}

export const FUNNEL = ["Signed up", "Set up their business", "Added a quote", "Followed up", "Paid"] as const;

export interface AccountSummary {
  id: string;
  email: string;
  signedUpAt: string;
  lastSignInAt: string | null;
  business: string | null;
  industry: string | null;
  quotes: number;
  followUpsDone: number;
  emailsSent: number;
  emailsFailed: number;
  messages: number;
  /** ai_usage keeps 7 days only. */
  aiDrafts7d: number;
  replies: number;
  visits30d: number;
  devices: Record<"phone" | "tablet" | "desktop", number>;
  /** The newest moment this account did anything (not just signed in). */
  lastActive: string | null;
  plan: PlanState;
  planEndsAt: string | null;
  planDaysLeft: number | null;
  everPaid: boolean;
  /** How far along the funnel: 0 = signed up only … 4 = paid. */
  step: number;
  /** Signed up over 2 days ago and never added a quote. */
  stalled: boolean;
}

const newest = (a: string | null, b: string | null | undefined) => (!b ? a : !a || b > a ? b : a);

function groupBy<T>(rows: T[], key: (r: T) => string | null | undefined) {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
}

export function summarizeAccounts(d: AdminData, now = new Date()): AccountSummary[] {
  const biz = new Map(d.businesses.map((b) => [b.user_id, b]));
  const subs = new Map(d.subscriptions.map((s) => [s.user_id, s]));
  const quotes = groupBy(d.quotes, (r) => r.user_id);
  const done = groupBy(d.followUpsDone, (r) => r.user_id);
  const emails = groupBy(d.emails, (r) => r.user_id);
  const messages = groupBy(d.messages, (r) => r.user_id);
  const ai = groupBy(d.aiDrafts, (r) => r.user_id);
  const replies = groupBy(d.replies, (r) => r.user_id);
  const visits = groupBy(d.visits, (r) => r.user_id);
  const since30 = new Date(now.getTime() - 30 * DAY).toISOString();
  const since7 = new Date(now.getTime() - 7 * DAY).toISOString();
  const stallBefore = new Date(now.getTime() - 2 * DAY).toISOString();

  return d.accounts.map((a) => {
    const q = quotes.get(a.id) ?? [];
    const f = done.get(a.id) ?? [];
    const e = emails.get(a.id) ?? [];
    const m = messages.get(a.id) ?? [];
    const x = ai.get(a.id) ?? [];
    const r = replies.get(a.id) ?? [];
    const v = visits.get(a.id) ?? [];
    let last: string | null = null;
    for (const t of q) last = newest(last, t.created_at);
    for (const t of f) last = newest(last, t.completed_at);
    for (const t of e) last = newest(last, t.created_at);
    for (const t of m) last = newest(last, t.created_at);
    for (const t of x) last = newest(last, t.created_at);
    for (const t of v) last = newest(last, t.at);
    last = newest(last, a.last_sign_in_at);
    const sub = subs.get(a.id);
    const plan = planOf(sub, now);
    const everPaid = Boolean(sub?.provider_subscription_id);
    const followedUp = f.length > 0;
    const step = everPaid ? 4 : followedUp ? 3 : q.length > 0 ? 2 : biz.has(a.id) ? 1 : 0;
    const recent = v.filter((t) => t.at >= since30);
    const devices = { phone: 0, tablet: 0, desktop: 0 };
    for (const t of recent) if (t.device in devices) devices[t.device as keyof typeof devices]++;
    return {
      id: a.id,
      email: a.email ?? "(no email)",
      signedUpAt: a.created_at,
      lastSignInAt: a.last_sign_in_at,
      business: biz.get(a.id)?.business_name ?? null,
      industry: biz.get(a.id)?.industry ?? null,
      quotes: q.length,
      followUpsDone: f.length,
      emailsSent: e.filter((t) => t.status === "sent").length,
      emailsFailed: e.filter((t) => t.status === "failed").length,
      messages: m.length,
      aiDrafts7d: x.filter((t) => t.created_at >= since7).length,
      replies: r.length,
      visits30d: recent.length,
      devices,
      lastActive: last,
      plan: plan.state,
      planEndsAt: plan.endsAt,
      planDaysLeft: plan.daysLeft,
      everPaid,
      step,
      stalled: q.length === 0 && a.created_at < stallBefore,
    };
  });
}

/** Monday 00:00 UTC of the week holding `t`. */
export function weekStart(t: Date): Date {
  const d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * DAY);
}

export interface Week {
  /** Monday, as YYYY-MM-DD. */
  start: string;
  value: number;
}

/** The last `count` weeks (this week last), with a value for each. */
export function weeks(count: number, now: Date, value: (from: string, to: string) => number): Week[] {
  const thisWeek = weekStart(now).getTime();
  const out: Week[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const from = new Date(thisWeek - i * 7 * DAY);
    const to = new Date(from.getTime() + 7 * DAY);
    out.push({ start: from.toISOString().slice(0, 10), value: value(from.toISOString(), to.toISOString()) });
  }
  return out;
}

export interface Overview {
  accounts: number;
  signupsThisWeek: number;
  signupsLastWeek: number;
  paying: number;
  /** Paying accounts that will renew (not cancelled), times the price. */
  monthlyRevenue: number;
  trials: number;
  trialsEndingSoon: AccountSummary[];
  funnel: { label: string; count: number }[];
  signupsByWeek: Week[];
  activeByWeek: Week[];
  stalled: AccountSummary[];
}

export function overview(d: AdminData, list: AccountSummary[], price: number, now = new Date()): Overview {
  const signups = weeks(12, now, (from, to) => d.accounts.filter((a) => a.created_at >= from && a.created_at < to).length);
  // Active in a week: did anything in QuoteLoop that week.
  const stamps: { user_id: string; at: string | null }[] = [
    ...d.quotes.map((r) => ({ user_id: r.user_id, at: r.created_at })),
    ...d.followUpsDone.map((r) => ({ user_id: r.user_id, at: r.completed_at })),
    ...d.emails.map((r) => ({ user_id: r.user_id, at: r.created_at })),
    ...d.messages.map((r) => ({ user_id: r.user_id, at: r.created_at })),
    ...d.visits.map((r) => ({ user_id: r.user_id, at: r.at })),
  ];
  const active = weeks(12, now, (from, to) => new Set(stamps.filter((s) => s.at && s.at >= from && s.at < to).map((s) => s.user_id)).size);
  const renewing = list.filter((a) => a.plan === "paying" || a.plan === "payment_failed").length;
  return {
    accounts: list.length,
    signupsThisWeek: signups[signups.length - 1]?.value ?? 0,
    signupsLastWeek: signups[signups.length - 2]?.value ?? 0,
    paying: list.filter((a) => a.plan === "paying" || a.plan === "payment_failed" || a.plan === "ending").length,
    monthlyRevenue: Math.round(renewing * price * 100) / 100,
    trials: list.filter((a) => a.plan === "trial").length,
    trialsEndingSoon: list
      .filter((a) => a.plan === "trial" && (a.planDaysLeft ?? 99) <= 7)
      .sort((a, b) => (a.planEndsAt ?? "").localeCompare(b.planEndsAt ?? "")),
    funnel: FUNNEL.map((label, i) => ({ label, count: list.filter((a) => a.step >= i).length })),
    signupsByWeek: signups,
    activeByWeek: active,
    stalled: list.filter((a) => a.stalled).sort((a, b) => b.signedUpAt.localeCompare(a.signedUpAt)),
  };
}

export interface ActivityReport {
  /** Last 30 days, busiest page first. */
  pages: { path: string; label: string; visits: number; accounts: number }[];
  devices: { device: string; visits: number }[];
  visitsByWeek: Week[];
  total30d: number;
}

export function activity(d: AdminData, now = new Date()): ActivityReport {
  const since = new Date(now.getTime() - 30 * DAY).toISOString();
  const recent = d.visits.filter((v) => v.at >= since);
  const byPath = groupBy(recent, (v) => v.path);
  const pages = [...byPath.entries()]
    .map(([path, rows]) => ({ path, label: pageLabel(path), visits: rows.length, accounts: new Set(rows.map((r) => r.user_id)).size }))
    .sort((a, b) => b.visits - a.visits || a.label.localeCompare(b.label));
  const devices = (["phone", "tablet", "desktop"] as const).map((device) => ({ device, visits: recent.filter((v) => v.device === device).length }));
  return {
    pages,
    devices,
    visitsByWeek: weeks(12, now, (from, to) => d.visits.filter((v) => v.at >= from && v.at < to).length),
    total30d: recent.length,
  };
}

export interface Health {
  emailsFailed30d: { at: string; email: string; error: string }[];
  forwardsFailed30d: { at: string; email: string; error: string }[];
  /** Payment events received over 10 minutes ago and never applied. */
  stuckBillingEvents: { id: string; type: string; receivedAt: string }[];
  lastBillingEventAt: string | null;
  aiDrafts7d: number;
}

/** Error texts can quote the recipient: the admin never shows a customer's address. */
export const redactEmails = (text: string) => text.replace(/[^\s<>"'(),;:]+@[^\s<>"'(),;:]+/g, "[address]");

export function health(d: AdminData, now = new Date()): Health {
  const since = new Date(now.getTime() - 30 * DAY).toISOString();
  const stuckBefore = new Date(now.getTime() - 10 * 60_000).toISOString();
  const since7 = new Date(now.getTime() - 7 * DAY).toISOString();
  const emailOf = new Map(d.accounts.map((a) => [a.id, a.email ?? "(no email)"]));
  return {
    emailsFailed30d: d.emails
      .filter((e) => e.status === "failed" && e.created_at >= since)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((e) => ({ at: e.created_at, email: emailOf.get(e.user_id) ?? "(deleted account)", error: redactEmails(e.error_message ?? "No reason given") })),
    forwardsFailed30d: d.replies
      .filter((r) => r.forward_error && r.received_at >= since)
      .sort((a, b) => b.received_at.localeCompare(a.received_at))
      .map((r) => ({ at: r.received_at, email: emailOf.get(r.user_id) ?? "(deleted account)", error: redactEmails(r.forward_error ?? "") })),
    stuckBillingEvents: d.billingEvents
      .filter((e) => !e.processed_at && e.received_at < stuckBefore)
      .sort((a, b) => b.received_at.localeCompare(a.received_at))
      .map((e) => ({ id: e.id, type: e.type, receivedAt: e.received_at })),
    lastBillingEventAt: d.billingEvents.reduce<string | null>((m, e) => newest(m, e.received_at), null),
    aiDrafts7d: d.aiDrafts.filter((a) => a.created_at >= since7).length,
  };
}

export interface TimelineDay {
  day: string;
  items: string[];
}

/** One account's last 30 days, a line per kind of thing per day: what, never the content. */
export function timeline(d: AdminData, userId: string, now = new Date()): TimelineDay[] {
  const since = new Date(now.getTime() - 30 * DAY).toISOString();
  const days = new Map<string, Map<string, number>>();
  const add = (at: string | null | undefined, what: string) => {
    if (!at || at < since) return;
    const day = at.slice(0, 10);
    const m = days.get(day) ?? new Map<string, number>();
    m.set(what, (m.get(what) ?? 0) + 1);
    days.set(day, m);
  };
  const mine = <T extends { user_id: string | null }>(rows: T[]) => rows.filter((r) => r.user_id === userId);
  for (const r of mine(d.quotes)) add(r.created_at, "quote added");
  for (const r of mine(d.followUpsDone)) add(r.completed_at, "follow-up done");
  for (const r of mine(d.emails)) add(r.created_at, r.status === "failed" ? "email failed" : "email sent");
  for (const r of mine(d.messages)) add(r.created_at, "message written");
  for (const r of mine(d.replies)) add(r.received_at, "customer reply");
  for (const r of mine(d.visits)) add(r.at, `opened ${pageLabel(r.path)}`);
  for (const r of mine(d.billingEvents)) add(r.occurred_at ?? r.received_at, `payment event: ${r.type}`);
  const account = d.accounts.find((a) => a.id === userId);
  add(account?.created_at, "signed up");
  return [...days.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, m]) => ({
      day,
      items: [...m.entries()].map(([what, n]) => (n > 1 ? `${n}× ${what}` : what)),
    }));
}

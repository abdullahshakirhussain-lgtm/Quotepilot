import Link from "next/link";
import {
  AlertCircle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  DollarSign,
  FileText,
  Percent,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate, relativeDay, todayISO } from "@/lib/utils";
import type { Business, FollowUpWithContext, Lead, Quote } from "@/lib/types";

export const dynamic = "force-dynamic";

const ACTIVE_LEAD_STATUSES = [
  "new",
  "contacted",
  "quote_sent",
  "follow_up_due",
  "negotiating",
];

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: business }, { data: leads }, { data: quotes }, { data: upcoming }] =
    await Promise.all([
      supabase
        .from("businesses")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle<Business>(),
      supabase.from("leads").select("status").eq("user_id", user!.id),
      supabase
        .from("quotes")
        .select("status, amount")
        .eq("user_id", user!.id),
      supabase
        .from("follow_ups")
        .select(
          "*, quote:quotes(id, title, amount, currency, status), lead:leads(id, customer_name, company_name)"
        )
        .eq("user_id", user!.id)
        .eq("status", "pending")
        .order("due_date", { ascending: true }),
    ]);

  const currency = business?.currency ?? "USD";
  const leadRows = (leads as Pick<Lead, "status">[]) ?? [];
  const quoteRows = (quotes as Pick<Quote, "status" | "amount">[]) ?? [];
  const upcomingRows: FollowUpWithContext[] = (upcoming ?? []).map((f) => ({
    ...(f as FollowUpWithContext),
    quote: Array.isArray(f.quote) ? (f.quote[0] ?? null) : (f.quote ?? null),
    lead: Array.isArray(f.lead) ? (f.lead[0] ?? null) : (f.lead ?? null),
  }));

  // --- Metrics --------------------------------------------------------------
  const activeLeads = leadRows.filter((l) =>
    ACTIVE_LEAD_STATUSES.includes(l.status)
  ).length;

  const nonDraft = quoteRows.filter((q) => q.status !== "draft");
  const quotesSent = nonDraft.length;
  const accepted = quoteRows.filter((q) => q.status === "accepted");
  const rejected = quoteRows.filter((q) => q.status === "rejected");

  const totalQuoted = nonDraft.reduce((s, q) => s + Number(q.amount), 0);
  const acceptedValue = accepted.reduce((s, q) => s + Number(q.amount), 0);
  const lostValue = rejected.reduce((s, q) => s + Number(q.amount), 0);
  const decided = accepted.length + rejected.length;
  const winRate = decided > 0 ? Math.round((accepted.length / decided) * 100) : 0;
  const avgQuote = nonDraft.length > 0 ? totalQuoted / nonDraft.length : 0;

  const dueToday = upcomingRows.filter(
    (f) => f.due_date.slice(0, 10) === today
  ).length;
  const overdue = upcomingRows.filter(
    (f) => f.due_date.slice(0, 10) < today
  ).length;

  const hasData = leadRows.length > 0 || quoteRows.length > 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {greeting()}, {business?.owner_name || "there"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Here&apos;s what&apos;s happening with your quotes.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/leads" className="btn-secondary">
            <Users className="h-4 w-4" /> Add lead
          </Link>
          <Link href="/quotes" className="btn-primary">
            <FileText className="h-4 w-4" /> New quote
          </Link>
        </div>
      </header>

      {!hasData && (
        <div className="rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-800">
          👋 New here? Head to{" "}
          <Link href="/settings" className="font-semibold underline">
            Settings → Load demo data
          </Link>{" "}
          to explore QuotePilot with realistic sample records.
        </div>
      )}

      {/* Attention row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Follow-ups due today"
          value={dueToday}
          icon={<CalendarClock className="h-5 w-5" />}
          tone="amber"
          href="/follow-ups"
        />
        <Stat
          label="Overdue follow-ups"
          value={overdue}
          icon={<AlertCircle className="h-5 w-5" />}
          tone="red"
          href="/follow-ups"
        />
        <Stat
          label="Active leads"
          value={activeLeads}
          icon={<Users className="h-5 w-5" />}
          tone="brand"
          href="/leads"
        />
        <Stat
          label="Quotes sent"
          value={quotesSent}
          icon={<FileText className="h-5 w-5" />}
          tone="slate"
          href="/quotes"
        />
      </div>

      {/* Value row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="Total quoted value"
          value={formatCurrency(totalQuoted, currency)}
          icon={<DollarSign className="h-5 w-5" />}
          tone="slate"
        />
        <Stat
          label="Accepted value"
          value={formatCurrency(acceptedValue, currency)}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="emerald"
        />
        <Stat
          label="Lost value"
          value={formatCurrency(lostValue, currency)}
          icon={<XCircle className="h-5 w-5" />}
          tone="red"
        />
        <Stat
          label="Win rate"
          value={`${winRate}%`}
          hint={`${accepted.length} won / ${rejected.length} lost`}
          icon={<Percent className="h-5 w-5" />}
          tone="brand"
        />
        <Stat
          label="Average quote value"
          value={formatCurrency(avgQuote, currency)}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="slate"
        />
      </div>

      {/* Upcoming follow-ups */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <BellRing className="h-4 w-4 text-brand-600" /> Upcoming follow-ups
          </h2>
          <Link
            href="/follow-ups"
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            View all
          </Link>
        </div>

        {upcomingRows.length === 0 ? (
          <EmptyState
            title="Nothing scheduled"
            description="Mark a quote as sent to start scheduling follow-up reminders."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {upcomingRows.slice(0, 6).map((f) => {
              const d = f.due_date.slice(0, 10);
              const late = d < today;
              return (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-800">
                      {f.quote?.title ?? "Quote"}
                    </div>
                    <div className="truncate text-sm text-slate-500">
                      {f.lead?.customer_name ?? "—"}
                      {f.quote
                        ? ` · ${formatCurrency(Number(f.quote.amount), f.quote.currency)}`
                        : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-sm font-medium ${
                        late ? "text-red-600" : "text-slate-700"
                      }`}
                    >
                      {relativeDay(f.due_date)}
                    </div>
                    <div className="text-xs text-slate-400">
                      {formatDate(f.due_date)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const TONES: Record<string, string> = {
  brand: "bg-brand-50 text-brand-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
  emerald: "bg-emerald-50 text-emerald-600",
  slate: "bg-slate-100 text-slate-500",
};

function Stat({
  label,
  value,
  icon,
  tone = "slate",
  hint,
  href,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone?: keyof typeof TONES | string;
  hint?: string;
  href?: string;
}) {
  const inner = (
    <div className="card h-full p-5 transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{label}</span>
        <span className={`grid h-9 w-9 place-items-center rounded-lg ${TONES[tone] ?? TONES.slate}`}>
          {icon}
        </span>
      </div>
      <div className="mt-3 text-2xl font-bold text-slate-900">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

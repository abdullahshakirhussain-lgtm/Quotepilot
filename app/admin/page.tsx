import { adminView } from "@/lib/admin/view";
import { overview } from "@/lib/admin/metrics";
import { PRICE_MONTHLY } from "@/lib/marketing";
import { formatCurrency } from "@/lib/utils";
import { BarRows, Empty, Figures, Section, WeekBars, ago, day } from "@/components/admin/AdminUI";
import { NotReady } from "@/components/admin/NotReady";

export default async function AdminOverview() {
  const v = await adminView();
  if (!v.ok) return <NotReady reason={v.reason} />;
  const o = overview(v.data, v.accounts, PRICE_MONTHLY, v.now);
  const first = o.funnel[0]?.count || 1;

  return (
    <>
      <h1 className="text-[22px] font-medium text-stone-900">Overview</h1>
      <NotReady missing={v.data.missing} />
      <Figures
        items={[
          { label: "Accounts", value: String(o.accounts) },
          { label: "Sign-ups this week", value: String(o.signupsThisWeek), note: `${o.signupsLastWeek} last week` },
          { label: "Paying", value: String(o.paying) },
          { label: "Monthly revenue", value: formatCurrency(o.monthlyRevenue, "USD"), note: "Estimate: renewing plans × price, before tax and fees" },
          { label: "On a free trial", value: String(o.trials) },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Sign-ups per week" aside="Last 12 weeks">
          <WeekBars weeks={o.signupsByWeek} label="Sign-ups" />
        </Section>
        <Section title="Active accounts per week" aside="Did anything in QuoteLoop">
          <WeekBars weeks={o.activeByWeek} label="Active accounts" />
        </Section>
      </div>

      <Section title="How far people get" aside="Every account, all time">
        <BarRows rows={o.funnel.map((f) => ({ label: f.label, value: f.count, note: `${Math.round((f.count / first) * 100)}%` }))} />
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Trials ending in 7 days" aside={`${o.trialsEndingSoon.length}`}>
          {o.trialsEndingSoon.length === 0 ? (
            <Empty>None this week.</Empty>
          ) : (
            <AccountList rows={o.trialsEndingSoon.map((a) => ({ id: a.id, email: a.email, right: `ends ${day(a.planEndsAt)}`, sub: `${a.quotes} quotes, last active ${ago(a.lastActive, v.now)}` }))} />
          )}
        </Section>
        <Section title="Signed up but no quote yet" aside={<a href="/admin/accounts?filter=stalled" className="hover:underline">See all {o.stalled.length}</a>}>
          {o.stalled.length === 0 ? (
            <Empty>Everyone who signed up over 2 days ago has added a quote.</Empty>
          ) : (
            <AccountList rows={o.stalled.slice(0, 6).map((a) => ({ id: a.id, email: a.email, right: `signed up ${ago(a.signedUpAt, v.now)}`, sub: a.business ?? "No business set up" }))} />
          )}
        </Section>
      </div>
    </>
  );
}

function AccountList({ rows }: { rows: { id: string; email: string; right: string; sub: string }[] }) {
  return (
    <ul className="divide-y divide-[#ECEEF1]">
      {rows.map((r) => (
        <li key={r.id} className="flex items-baseline justify-between gap-3 px-5 py-3">
          <div className="min-w-0">
            <a href={`/admin/accounts/${r.id}`} className="font-medium text-stone-900 [overflow-wrap:anywhere] hover:underline">
              {r.email}
            </a>
            <div className="text-[13px] text-stone-500 [overflow-wrap:anywhere]">{r.sub}</div>
          </div>
          <span className="shrink-0 text-[13px] text-stone-600">{r.right}</span>
        </li>
      ))}
    </ul>
  );
}

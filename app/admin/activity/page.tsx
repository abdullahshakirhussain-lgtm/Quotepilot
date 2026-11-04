import { adminView } from "@/lib/admin/view";
import { activity } from "@/lib/admin/metrics";
import { BarRows, Empty, Figures, Section, WeekBars } from "@/components/admin/AdminUI";
import { NotReady } from "@/components/admin/NotReady";

/** Which pages people open, and on what size of screen. */
export default async function AdminActivity() {
  const v = await adminView();
  if (!v.ok) return <NotReady reason={v.reason} />;
  const r = activity(v.data, v.now);
  const share = (n: number) => (r.total30d ? `${Math.round((n / r.total30d) * 100)}%` : "0%");
  const accountsActive = new Set(v.data.visits.filter((x) => x.at >= new Date(v.now.getTime() - 30 * 86_400_000).toISOString()).map((x) => x.user_id)).size;

  return (
    <>
      <h1 className="text-[22px] font-medium text-stone-900">Activity</h1>
      <NotReady missing={v.data.missing} />
      <Figures
        items={[
          { label: "Page visits, 30 days", value: String(r.total30d) },
          { label: "Accounts that opened QuoteLoop", value: String(accountsActive), note: "Last 30 days" },
          ...r.devices.map((d) => ({
            label: d.device === "desktop" ? "On a computer" : d.device === "tablet" ? "On a tablet" : "On a phone",
            value: share(d.visits),
            note: `${d.visits} visits`,
          })),
        ]}
      />
      <Section title="Page visits per week" aside="Last 12 weeks">
        <WeekBars weeks={r.visitsByWeek} label="Page visits" />
      </Section>
      <Section title="Pages opened" aside="Last 30 days: visits, and how many accounts">
        {r.pages.length === 0 ? (
          <Empty>No page visits recorded yet. They start once the admin SQL has been run and people use the app.</Empty>
        ) : (
          <BarRows rows={r.pages.map((p) => ({ label: p.label, value: p.visits, note: `${p.accounts} ${p.accounts === 1 ? "account" : "accounts"}` }))} />
        )}
      </Section>
    </>
  );
}

import { adminView } from "@/lib/admin/view";
import { overview, PLAN_LABELS, type PlanState } from "@/lib/admin/metrics";
import { PRICE_MONTHLY } from "@/lib/marketing";
import { formatCurrency } from "@/lib/utils";
import { BarRows, Empty, Figures, Section, ago, day } from "@/components/admin/AdminUI";
import { NotReady } from "@/components/admin/NotReady";

const ORDER: PlanState[] = ["trial", "paying", "payment_failed", "ending", "expired", "comped", "none"];

/** Plans, the revenue estimate, and every payment event as Paddle sent it. */
export default async function AdminBilling() {
  const v = await adminView();
  if (!v.ok) return <NotReady reason={v.reason} />;
  const o = overview(v.data, v.accounts, PRICE_MONTHLY, v.now);
  const failed = v.accounts.filter((a) => a.plan === "payment_failed");
  const leaving = v.accounts.filter((a) => a.plan === "ending");
  const emailOf = new Map(v.accounts.map((a) => [a.id, a.email]));
  const events = [...v.data.billingEvents].sort((a, b) => b.received_at.localeCompare(a.received_at)).slice(0, 30);

  return (
    <>
      <h1 className="text-[22px] font-medium text-stone-900">Billing</h1>
      <Figures
        items={[
          { label: "Paying", value: String(o.paying) },
          { label: "Monthly revenue", value: formatCurrency(o.monthlyRevenue, "USD"), note: "Estimate: renewing plans × price. Paddle has the exact payouts." },
          { label: "Payment failed", value: String(failed.length) },
          { label: "Cancelled, still paid up", value: String(leaving.length) },
        ]}
      />
      <Section title="Accounts by plan">
        <BarRows rows={ORDER.map((s) => ({ label: PLAN_LABELS[s], value: v.accounts.filter((a) => a.plan === s).length }))} />
      </Section>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Payment failed" aside="Still usable during the grace period">
          {failed.length === 0 ? <Empty>None.</Empty> : <People rows={failed.map((a) => ({ id: a.id, email: a.email, right: `access until ${day(a.planEndsAt)}` }))} />}
        </Section>
        <Section title="Cancelled" aside="Paid until the date shown">
          {leaving.length === 0 ? <Empty>None.</Empty> : <People rows={leaving.map((a) => ({ id: a.id, email: a.email, right: `until ${day(a.planEndsAt)}` }))} />}
        </Section>
      </div>
      <Section title="Latest payment events" aside="As received from Paddle">
        {events.length === 0 ? (
          <Empty>No payment events yet.</Empty>
        ) : (
          <ul className="divide-y divide-[#ECEEF1]">
            {events.map((e) => (
              <li key={e.id} className="grid grid-cols-1 gap-1 px-5 py-2.5 text-[14px] sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:gap-4">
                <span className="font-medium text-stone-900">{e.type}</span>
                <span className="text-stone-600 [overflow-wrap:anywhere]">{e.user_id ? (emailOf.get(e.user_id) ?? "(deleted account)") : "No account named"}</span>
                <span className="whitespace-nowrap text-stone-500">
                  {day(e.occurred_at ?? e.received_at)}
                  {!e.processed_at && <span className="ml-2 font-medium text-red-700">not applied</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <p className="text-[13px] text-stone-500">Latest event received {ago(v.data.billingEvents.reduce<string | null>((m, e) => (!m || e.received_at > m ? e.received_at : m), null), v.now)}.</p>
    </>
  );
}

function People({ rows }: { rows: { id: string; email: string; right: string }[] }) {
  return (
    <ul className="divide-y divide-[#ECEEF1]">
      {rows.map((r) => (
        <li key={r.id} className="flex items-baseline justify-between gap-3 px-5 py-3 text-[14px]">
          <a href={`/admin/accounts/${r.id}`} className="font-medium text-stone-900 [overflow-wrap:anywhere] hover:underline">
            {r.email}
          </a>
          <span className="shrink-0 text-stone-600">{r.right}</span>
        </li>
      ))}
    </ul>
  );
}

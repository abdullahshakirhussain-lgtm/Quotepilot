import { adminView } from "@/lib/admin/view";
import { health } from "@/lib/admin/metrics";
import { Empty, Figures, Section, ago, day } from "@/components/admin/AdminUI";
import { NotReady } from "@/components/admin/NotReady";

/** What went wrong lately: emails that failed, replies not forwarded, payment events not applied. */
export default async function AdminHealth() {
  const v = await adminView();
  if (!v.ok) return <NotReady reason={v.reason} />;
  const h = health(v.data, v.now);

  return (
    <>
      <h1 className="text-[22px] font-medium text-stone-900">Health</h1>
      <NotReady missing={v.data.missing} />
      <Figures
        items={[
          { label: "Emails failed, 30 days", value: String(h.emailsFailed30d.length) },
          { label: "Replies not forwarded, 30 days", value: String(h.forwardsFailed30d.length) },
          { label: "Payment events not applied", value: String(h.stuckBillingEvents.length), note: "Received over 10 minutes ago" },
          { label: "AI drafts, 7 days", value: String(h.aiDrafts7d) },
          { label: "Latest payment event", value: ago(h.lastBillingEventAt, v.now) },
        ]}
      />
      <Problems title="Emails that failed" rows={h.emailsFailed30d} empty="No failed emails in the last 30 days." />
      <Problems title="Customer replies that couldn't be forwarded" rows={h.forwardsFailed30d} empty="Every reply in the last 30 days was forwarded." />
      <Section title="Payment events not applied">
        {h.stuckBillingEvents.length === 0 ? (
          <Empty>None. Every payment event has been applied.</Empty>
        ) : (
          <ul className="divide-y divide-[#ECEEF1]">
            {h.stuckBillingEvents.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-x-4 px-5 py-2.5 text-[14px]">
                <span className="font-medium text-stone-900">{e.type}</span>
                <span className="text-stone-500">
                  received {day(e.receivedAt)}, id {e.id}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function Problems({ title, rows, empty }: { title: string; rows: { at: string; email: string; error: string }[]; empty: string }) {
  return (
    <Section title={title} aside={rows.length > 20 ? `Latest 20 of ${rows.length}` : undefined}>
      {rows.length === 0 ? (
        <Empty>{empty}</Empty>
      ) : (
        <ul className="divide-y divide-[#ECEEF1]">
          {rows.slice(0, 20).map((r, i) => (
            <li key={`${r.at}-${i}`} className="grid grid-cols-1 gap-1 px-5 py-2.5 text-[14px] sm:grid-cols-[8rem_minmax(0,14rem)_minmax(0,1fr)] sm:gap-4">
              <span className="num text-stone-500">{day(r.at)}</span>
              <span className="text-stone-900 [overflow-wrap:anywhere]">{r.email}</span>
              <span className="text-stone-600 [overflow-wrap:anywhere]">{r.error}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

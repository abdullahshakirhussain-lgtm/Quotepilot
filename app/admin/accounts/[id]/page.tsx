import { notFound } from "next/navigation";
import { adminView } from "@/lib/admin/view";
import { FUNNEL, timeline } from "@/lib/admin/metrics";
import { Empty, Figures, Plan, Section, ago, day } from "@/components/admin/AdminUI";
import { NotReady } from "@/components/admin/NotReady";

/** One account: who, plan, how far along, usage and the last 30 days. Counts and dates only. */
export default async function AdminAccount({ params }: { params: Promise<{ id: string }> }) {
  const v = await adminView();
  if (!v.ok) return <NotReady reason={v.reason} />;
  const { id } = await params;
  const a = v.accounts.find((x) => x.id === id);
  if (!a) notFound();
  const days = timeline(v.data, a.id, v.now);
  const sub = v.data.subscriptions.find((s) => s.user_id === a.id);

  return (
    <>
      <div>
        <a href="/admin/accounts" className="text-[14px] text-stone-600 hover:underline">
          All accounts
        </a>
        <h1 className="mt-1 text-[22px] font-medium text-stone-900 [overflow-wrap:anywhere]">{a.email}</h1>
        <p className="text-[14px] text-stone-600">
          {a.business ?? "No business set up"}
          {a.industry && a.business ? `, ${a.industry}` : ""}
        </p>
      </div>

      <Section title="Account">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 px-5 py-4 text-[14px] sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Plan">
            <Plan state={a.plan} />
            {a.planEndsAt && <span className="ml-2 text-stone-600">until {day(a.planEndsAt)}</span>}
          </Fact>
          <Fact label="Signed up">
            {day(a.signedUpAt)} <span className="text-stone-500">({ago(a.signedUpAt, v.now)})</span>
          </Fact>
          <Fact label="Last active">{ago(a.lastActive, v.now)}</Fact>
          <Fact label="Last signed in">{ago(a.lastSignInAt, v.now)}</Fact>
          <Fact label="Furthest step">{FUNNEL[a.step]}</Fact>
          <Fact label="Paid at least once">{a.everPaid ? "Yes" : "No"}</Fact>
          {sub?.cancel_at_period_end && <Fact label="Renewal">Cancelled, ends {day(sub.current_period_end)}</Fact>}
        </dl>
      </Section>

      <Figures
        items={[
          { label: "Quotes", value: String(a.quotes) },
          { label: "Follow-ups done", value: String(a.followUpsDone) },
          { label: "Emails sent", value: String(a.emailsSent), note: a.emailsFailed ? `${a.emailsFailed} failed` : undefined },
          { label: "Messages written", value: String(a.messages), note: `${a.aiDrafts7d} AI drafts in 7 days` },
          { label: "Customer replies", value: String(a.replies) },
          {
            label: "Page visits, 30 days",
            value: String(a.visits30d),
            note: a.visits30d ? `${a.devices.phone} phone, ${a.devices.tablet} tablet, ${a.devices.desktop} computer` : undefined,
          },
        ]}
      />

      <Section title="Last 30 days" aside="What happened, never the content">
        {days.length === 0 ? (
          <Empty>Nothing in the last 30 days.</Empty>
        ) : (
          <ol className="divide-y divide-[#ECEEF1]">
            {days.map((d) => (
              <li key={d.day} className="grid grid-cols-1 gap-1 px-5 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
                <span className="num text-[14px] font-medium text-stone-900">{day(`${d.day}T00:00:00Z`)}</span>
                <span className="text-[14px] text-stone-600">{d.items.join(", ")}</span>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-stone-500">{label}</dt>
      <dd className="mt-0.5 text-stone-900">{children}</dd>
    </div>
  );
}

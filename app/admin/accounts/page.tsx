import { adminView } from "@/lib/admin/view";
import type { AccountSummary } from "@/lib/admin/metrics";
import { cn } from "@/lib/utils";
import { Empty, Plan, ago, day } from "@/components/admin/AdminUI";
import { NotReady } from "@/components/admin/NotReady";

const FILTERS: { key: string; label: string; keep: (a: AccountSummary) => boolean }[] = [
  { key: "all", label: "All", keep: () => true },
  { key: "stalled", label: "No quote yet", keep: (a) => a.stalled },
  { key: "trial", label: "On trial", keep: (a) => a.plan === "trial" },
  { key: "ending", label: "Trial ends in 7 days", keep: (a) => a.plan === "trial" && (a.planDaysLeft ?? 99) <= 7 },
  { key: "paying", label: "Paying", keep: (a) => a.plan === "paying" },
  { key: "failed", label: "Payment failed", keep: (a) => a.plan === "payment_failed" },
  { key: "gone", label: "Cancelled or expired", keep: (a) => a.plan === "ending" || a.plan === "expired" },
];

export default async function AdminAccounts({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string }> }) {
  const v = await adminView();
  if (!v.ok) return <NotReady reason={v.reason} />;
  const { filter = "all", q = "" } = await searchParams;
  const f = FILTERS.find((x) => x.key === filter) ?? FILTERS[0];
  const needle = q.trim().toLowerCase().slice(0, 100);
  const rows = v.accounts
    .filter(f.keep)
    .filter((a) => !needle || a.email.toLowerCase().includes(needle) || (a.business ?? "").toLowerCase().includes(needle))
    .sort((a, b) => b.signedUpAt.localeCompare(a.signedUpAt));

  return (
    <>
      <h1 className="text-[22px] font-medium text-stone-900">Accounts</h1>
      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Filter accounts" className="flex flex-wrap gap-1.5">
          {FILTERS.map((x) => {
            const on = x.key === f.key;
            const n = v.accounts.filter(x.keep).length;
            return (
              <a
                key={x.key}
                href={`/admin/accounts?filter=${x.key}${needle ? `&q=${encodeURIComponent(needle)}` : ""}`}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "tap inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-medium",
                  on ? "border-stone-300 bg-stone-200/80 text-stone-900" : "border-line bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900"
                )}
              >
                {x.label} <span className="num text-stone-500">{n}</span>
              </a>
            );
          })}
        </nav>
        <form action="/admin/accounts" className="ml-auto flex w-full gap-2 sm:w-auto">
          <input type="hidden" name="filter" value={f.key} />
          <label htmlFor="admin-q" className="sr-only">
            Search by email or business
          </label>
          <input id="admin-q" name="q" defaultValue={needle} placeholder="Email or business" className="input h-10 py-0 sm:w-64" />
          <button className="btn-secondary">Search</button>
        </form>
      </div>

      <section className="card overflow-hidden" aria-label="Accounts">
        {rows.length === 0 ? (
          <Empty>No accounts match.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-[14px]">
              <thead>
                <tr className="text-left text-[13px] text-stone-500">
                  <th className="px-5 py-2.5 font-normal">Account</th>
                  <th className="px-3 py-2.5 font-normal">Plan</th>
                  <th className="px-3 py-2.5 font-normal">Signed up</th>
                  <th className="px-3 py-2.5 font-normal">Last active</th>
                  <th className="px-3 py-2.5 text-right font-normal">Quotes</th>
                  <th className="px-3 py-2.5 text-right font-normal">Follow-ups</th>
                  <th className="px-5 py-2.5 text-right font-normal">Visits, 30 days</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-t border-[#ECEEF1] align-top">
                    <td className="px-5 py-3">
                      <a href={`/admin/accounts/${a.id}`} className="font-medium text-stone-900 [overflow-wrap:anywhere] hover:underline">
                        {a.email}
                      </a>
                      <div className="text-[13px] text-stone-500">{a.business ?? "No business set up"}</div>
                    </td>
                    <td className="px-3 py-3">
                      <Plan state={a.plan} />
                    </td>
                    <td className="num whitespace-nowrap px-3 py-3 text-stone-600">{day(a.signedUpAt)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-stone-600">{ago(a.lastActive, v.now)}</td>
                    <td className="num px-3 py-3 text-right">{a.quotes}</td>
                    <td className="num px-3 py-3 text-right">{a.followUpsDone}</td>
                    <td className="num px-5 py-3 text-right">{a.visits30d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-[13px] text-stone-500">
        {rows.length} of {v.accounts.length} accounts. Last active means the newest thing the account did: a quote, a follow-up, an email, a
        message, a page opened or a sign-in.
      </p>
    </>
  );
}

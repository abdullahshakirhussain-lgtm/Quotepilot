// Small building blocks for the admin pages: same cards, type and colours as
// the app, nothing new to learn.
import { cn } from "@/lib/utils";
import { PLAN_LABELS, type PlanState, type Week } from "@/lib/admin/metrics";

const DAY_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const SHORT_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "Nov 4, 2026" (UTC). */
export const day = (iso: string | null | undefined) => (iso ? DAY_FMT.format(new Date(iso)) : "–");

/** "today", "3 days ago", "in 5 days". */
export function ago(iso: string | null | undefined, now = new Date()) {
  if (!iso) return "never";
  const d = Math.round((now.getTime() - Date.parse(iso)) / 86_400_000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d === -1) return "tomorrow";
  return d > 0 ? `${d} days ago` : `in ${-d} days`;
}

export function Section({ title, aside, children, className }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("card", className)} aria-label={title}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#ECEEF1] px-5 py-3">
        <h2 className="text-[16px] font-medium text-stone-900">{title}</h2>
        {aside && <div className="text-[13px] text-stone-500">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

/** A row of figures in one card, split by hairlines. */
export function Figures({ items }: { items: { label: string; value: string; note?: string }[] }) {
  return (
    <dl className="card grid grid-cols-2 divide-[#ECEEF1] sm:grid-cols-3 lg:flex lg:divide-x">
      {items.map((f) => (
        <div key={f.label} className="min-w-0 flex-1 px-5 py-3.5">
          <dt className="text-[13px] text-stone-500">{f.label}</dt>
          <dd className="num mt-1 text-[22px] font-medium leading-tight text-stone-900">{f.value}</dd>
          {f.note && <dd className="mt-0.5 text-[12px] text-stone-500">{f.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** One series of weekly bars, one hue, the value on hover and in the table for screen readers. */
export function WeekBars({ weeks, label }: { weeks: Week[]; label: string }) {
  const max = Math.max(1, ...weeks.map((w) => w.value));
  return (
    <figure className="px-5 py-4">
      <div className="flex h-36 items-end gap-1.5" aria-hidden="true">
        {weeks.map((w, i) => (
          <div key={w.start} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">
            <span className="num pointer-events-none absolute -top-0.5 left-1/2 -translate-x-1/2 text-[11px] text-stone-500 opacity-0 transition-opacity group-hover:opacity-100">
              {w.value}
            </span>
            <div
              className={cn("w-full rounded-t-[4px]", i === weeks.length - 1 ? "bg-info-500" : "bg-stone-400")}
              style={{ height: w.value === 0 ? "2px" : `${Math.max(4, (w.value / max) * 100)}%` }}
              title={`Week of ${SHORT_FMT.format(new Date(w.start))}: ${w.value}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-stone-500" aria-hidden="true">
        <span>{SHORT_FMT.format(new Date(weeks[0]?.start ?? Date.now()))}</span>
        <span>This week</span>
      </div>
      <table className="sr-only">
        <caption>{label}, by week</caption>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.start}>
              <th>Week of {SHORT_FMT.format(new Date(w.start))}</th>
              <td>{w.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** A labelled bar per row, for counts that compare (the funnel, pages). */
export function BarRows({ rows }: { rows: { label: string; value: number; note?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-3 px-5 py-4">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-3 text-[14px]">
          <span className="truncate text-stone-700">{r.label}</span>
          <span className="h-2.5 rounded-full bg-stone-100">
            <span className="block h-full rounded-full bg-stone-500" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="num whitespace-nowrap text-right font-medium text-stone-900">
            {r.value}
            {r.note && <span className="ml-1.5 font-normal text-stone-500">{r.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

const PLAN_CHIP: Record<PlanState, string> = {
  trial: "chip-soon",
  paying: "chip-won",
  ending: "chip-muted",
  payment_failed: "chip-late",
  expired: "chip-muted",
  comped: "chip-muted",
  none: "chip-muted",
};
export function Plan({ state }: { state: PlanState }) {
  return <span className={PLAN_CHIP[state]}>{PLAN_LABELS[state]}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-4 text-[14px] text-stone-500">{children}</p>;
}

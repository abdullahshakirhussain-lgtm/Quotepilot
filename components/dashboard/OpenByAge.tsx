import { cn, formatCurrency } from "@/lib/utils";
import type { AgeBucket } from "@/lib/metrics";

/** Fresh quotes in the action colour; older ones warm up to red as they go cold. */
const BAR: Record<AgeBucket["key"], string> = {
  week: "bg-info-500",
  fortnight: "bg-info-500",
  month: "bg-due-500",
  cold: "bg-red-500",
};

/**
 * Open quotes by how long they've waited: one row per age, the bar as long as
 * the money in it, the amount and count written beside it (so nothing depends
 * on colour or on reading a bar's length).
 */
export function OpenByAge({ ages, currency }: { ages: AgeBucket[]; currency: string }) {
  const max = Math.max(...ages.map((a) => a.amount), 0);
  const cold = ages.find((a) => a.key === "cold");
  return (
    <div className="mt-3">
      <ul className="flex flex-col gap-2.5" aria-label="Open quotes by how long they've waited">
        {ages.map((a) => (
          <li key={a.key} className="grid grid-cols-[6.25rem_minmax(0,1fr)_auto] items-center gap-3">
            <span className={cn("text-[13px]", a.key === "cold" && a.count > 0 ? "font-medium text-red-700" : "text-stone-600")}>{a.label}</span>
            <span className="h-3" aria-hidden="true">
              {a.amount > 0 && (
                <span
                  className={cn("block h-full rounded-r-[4px]", BAR[a.key])}
                  style={{ width: `${Math.max(3, (a.amount / max) * 100)}%` }}
                />
              )}
              {a.amount === 0 && <span className="block h-full w-px bg-stone-300" />}
            </span>
            <span className="num text-right text-[14px]">
              <span className={cn("font-medium", a.count ? "text-stone-900" : "text-stone-400")}>{formatCurrency(a.amount, currency)}</span>
              <span className="block text-[12px] text-stone-500">
                {a.count} {a.count === 1 ? "quote" : "quotes"}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {cold && cold.count > 0 && (
        <p className="mt-3 border-t border-[#ECEEF1] pt-3 text-[14px] text-stone-700">
          <span className="num font-medium text-red-700">{formatCurrency(cold.amount, currency)}</span> has waited over 30 days. Those
          customers are the ones to call first.
        </p>
      )}
    </div>
  );
}

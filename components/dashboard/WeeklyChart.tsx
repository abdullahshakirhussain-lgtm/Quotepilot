"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { WeekCount } from "@/lib/dashboard-extras";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Sep 14", from YYYY-MM-DD, without time zones getting involved. */
const shortDay = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
const plural = (n: number) => `${n} follow-up${n === 1 ? "" : "s"}`;

/**
 * Follow-ups done each week, the last eight, this week in colour. One series,
 * so no legend: the card's title names it. Each bar shows its week and count
 * on hover, tap or keyboard focus, and the same numbers are in a table for
 * screen readers.
 */
export function WeeklyChart({ weeks }: { weeks: WeekCount[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...weeks.map((w) => w.count), 1);
  const last = weeks.length - 1;
  const total = weeks.reduce((n, w) => n + w.count, 0);

  return (
    <figure className="mt-3">
      <div className="relative" aria-hidden="true">
        {/* Bars sit on one baseline; a week with none keeps a stub, so the weeks still read as a row. */}
        <div className="flex h-24 items-end gap-1.5 border-b border-stone-300" onMouseLeave={() => setActive(null)}>
          {weeks.map((w, i) => {
            const h = w.count === 0 ? 2 : Math.max(6, Math.round((w.count / max) * 88));
            return (
              <div
                key={w.start}
                className="group relative flex h-full flex-1 cursor-default items-end justify-center"
                onMouseEnter={() => setActive(i)}
                onClick={() => setActive((a) => (a === i ? null : i))}
              >
                {i === last && w.count > 0 && active !== i && (
                  <span className="num absolute text-[12px] font-medium text-stone-900" style={{ bottom: h + 4 }}>
                    {w.count}
                  </span>
                )}
                <div
                  className={cn(
                    "w-full max-w-7 rounded-t-[4px] transition-[height] duration-200 motion-reduce:transition-none",
                    i === last ? "bg-info-500" : active === i ? "bg-stone-500" : "bg-stone-400"
                  )}
                  style={{ height: h }}
                />
                {active === i && (
                  <div
                    className={cn(
                      "pointer-events-none absolute z-10 whitespace-nowrap rounded-md bg-stone-900 px-2 py-1 text-[12px] text-white shadow-md",
                      i === 0 ? "left-0" : i === last ? "right-0" : "left-1/2 -translate-x-1/2"
                    )}
                    style={{ bottom: h + 6 }}
                  >
                    <span className="num">{i === last ? "This week" : `Week of ${shortDay(w.start)}`}: {plural(w.count)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex justify-between text-[12px] text-stone-500">
          <span className="num">{shortDay(weeks[0].start)}</span>
          <span>This week</span>
        </div>
      </div>
      {/* The same numbers, for screen readers. */}
      <table className="sr-only">
        <caption>Follow-ups done each week, the last {weeks.length} weeks</caption>
        <thead>
          <tr>
            <th scope="col">Week</th>
            <th scope="col">Follow-ups done</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w, i) => (
            <tr key={w.start}>
              <th scope="row">{i === last ? "This week" : `Week of ${shortDay(w.start)}`}</th>
              <td>{w.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {total === 0 && (
        <figcaption className="mt-2 text-[13px] text-stone-500">Each follow-up you do shows up here, week by week.</figcaption>
      )}
    </figure>
  );
}

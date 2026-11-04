"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { AppNotification } from "@/lib/notifications";
import { markUpdatesRead, openUpdate } from "@/components/UpdatesBell";

/**
 * "While you were away": unread updates at the top of the dashboard, so a
 * reply or a billing change that happened in the background isn't missed.
 * Stays until dismissed (or read under the bell).
 */
export function AwayUpdates({ items, total }: { items: Pick<AppNotification, "id" | "kind" | "quote_id" | "title" | "body">[]; total: number }) {
  const [hidden, setHidden] = useState(false);
  if (hidden || items.length === 0) return null;
  const more = total - items.length;

  return (
    <section className="ql-in rounded-[12px] border border-info-500/30 bg-info-50 px-4 py-3" aria-labelledby="away-title">
      <div className="flex items-start justify-between gap-3">
        <h2 id="away-title" className="text-[15px] font-medium text-info-700">
          While you were away
        </h2>
        <button
          type="button"
          className="tap -mr-2 -mt-1 inline-flex items-center justify-center px-2 text-info-700 hover:text-stone-900"
          aria-label="Mark these as seen"
          title="Mark these as seen"
          onClick={() => {
            setHidden(true);
            markUpdatesRead();
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="mt-1 flex flex-col gap-1">
        {items.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              className="tap inline-flex w-full flex-col items-start justify-center text-left text-[14px] hover:underline"
              onClick={() => {
                markUpdatesRead(n.id);
                openUpdate(n);
              }}
            >
              <span className="font-medium text-stone-900 [overflow-wrap:anywhere]">{n.title}</span>
              {n.body && <span className="line-clamp-1 text-stone-600 [overflow-wrap:anywhere]">{n.body}</span>}
            </button>
          </li>
        ))}
      </ul>
      {more > 0 && <p className="mt-1 text-[13px] text-info-700">And {more} more under the bell at the top.</p>}
    </section>
  );
}

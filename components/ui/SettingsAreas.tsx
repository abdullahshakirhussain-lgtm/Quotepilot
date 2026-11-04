"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { SETTINGS_AREAS, settingsHref, type SettingsArea } from "@/lib/settings-areas";

/** Which area an old in-page link (#billing, #templates…) belongs to. */
const HASH_AREA: Record<string, SettingsArea> = {
  billing: "billing",
  templates: "messages",
  "sign-off": "messages",
};

/**
 * The Settings areas, one view each. Plain links (a fresh page): same-page
 * navigation can stall on Settings (Next 15.5). Older links that point at a
 * section with a #hash (emails already sent, bookmarks) are sent on to the
 * area that holds it.
 */
export function SettingsAreas({ current }: { current: SettingsArea }) {
  useEffect(() => {
    const area = HASH_AREA[window.location.hash.slice(1)];
    if (!area || area === current) return;
    const params = new URLSearchParams(window.location.search);
    params.set("area", area);
    window.location.replace(`/settings?${params.toString()}`);
  }, [current]);

  return (
    <nav aria-label="Settings areas" className="mb-5 flex max-w-full gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {SETTINGS_AREAS.map((a) => {
        const on = a.key === current;
        return (
          <a
            key={a.key}
            href={settingsHref(a.key)}
            aria-current={on ? "page" : undefined}
            className={cn(
              "tap inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-[14px] font-medium transition-colors duration-150",
              on ? "border-stone-300 bg-stone-200/80 text-stone-900" : "border-line bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900"
            )}
          >
            {a.label}
          </a>
        );
      })}
    </nav>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TIMEZONE_COOKIE } from "@/lib/constants";

function readCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

/**
 * Shares the browser's time zone with the server, so "today", due and overdue
 * are computed in each viewer's own local day (server-side, so every page
 * agrees). Renders nothing.
 */
export function TimezoneCookie() {
  const router = useRouter();

  useEffect(() => {
    let tz: string | undefined;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!tz || !/^[A-Za-z0-9_+\-/]{1,64}$/.test(tz) || readCookie(TIMEZONE_COOKIE) === tz) return;

    const secure = window.location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${TIMEZONE_COOKIE}=${tz}; path=/; max-age=31536000; samesite=lax${secure}`;
    // Re-render server-computed dates once, only if the cookie actually stuck
    // (browsers that block cookies must not end up in a refresh loop).
    if (readCookie(TIMEZONE_COOKIE) === tz) router.refresh();
  }, [router]);

  return null;
}

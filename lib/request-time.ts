// Server-only: the time zone and "today" for the current request.
// Viewer's browser zone (cookie) -> APP_TIMEZONE deployment fallback -> UTC.
import { cookies } from "next/headers";
import { TIMEZONE_COOKIE } from "./constants";
import { resolveTimeZone, todayISO } from "./utils";

export async function getRequestTimeZone(): Promise<string> {
  const store = await cookies();
  return resolveTimeZone(store.get(TIMEZONE_COOKIE)?.value, process.env.APP_TIMEZONE);
}

/** Today's date (YYYY-MM-DD) in the viewer's time zone. */
export async function requestToday(): Promise<string> {
  return todayISO(await getRequestTimeZone());
}

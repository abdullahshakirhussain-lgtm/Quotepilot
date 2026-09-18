// ---------------------------------------------------------------------------
// Small dependency-free helpers: classnames, formatting, dates and CSV.
// ---------------------------------------------------------------------------

/** Join truthy class names. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

// Formatting uses one fixed locale on purpose: month-name dates ("Sep 13, 2026")
// are unambiguous in every market, and server and browser render identically.
export function formatCurrency(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount ?? 0);
  } catch {
    // Unknown currency code — fall back to a plain number with the code.
    return `${currency} ${(amount ?? 0).toLocaleString("en-US", {
      maximumFractionDigits: 2,
    })}`;
  }
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  // Date-only values (quote_date, valid_until, due_date) are calendar dates, not
  // instants. `new Date("2026-09-13")` is UTC midnight, which renders as Sep 12
  // anywhere west of UTC — so parse them as local midnight instead.
  const d = DATE_ONLY.test(value) ? new Date(value + "T00:00:00") : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Time zones. Three separate ideas, never mixed:
//   1. Viewer time zone  — the browser's IANA zone, shared with the server via a
//      cookie (see components/TimezoneCookie.tsx). Used for "today".
//   2. Deployment fallback — APP_TIMEZONE, only used before the viewer's zone is
//      known. It is not a business setting.
//   3. Neutral default   — UTC, when neither is available.
// Resolution happens server-side in lib/request-time.ts.
// ---------------------------------------------------------------------------

const TIME_ZONE_NAME = /^[A-Za-z0-9_+\-/]{1,64}$/;

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz || !TIME_ZONE_NAME.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Viewer's zone if valid, else the deployment fallback if valid, else UTC. */
export function resolveTimeZone(
  viewerZone?: string | null,
  deploymentFallback?: string | null
): string {
  if (isValidTimeZone(viewerZone)) return viewerZone;
  const fallback = deploymentFallback?.trim();
  if (isValidTimeZone(fallback)) return fallback;
  return "UTC";
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24 };
}

/** Today's date as YYYY-MM-DD in `timeZone` (or the local clock if omitted). */
export function todayISO(timeZone?: string): string {
  if (isValidTimeZone(timeZone)) return zonedParts(new Date(), timeZone).date;
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

/** Current hour (0–23) in `timeZone` (or the local clock if omitted). */
export function currentHour(timeZone?: string): number {
  if (isValidTimeZone(timeZone)) return zonedParts(new Date(), timeZone).hour;
  return new Date().getHours();
}

/** Add `days` to a YYYY-MM-DD string and return YYYY-MM-DD. */
export function addDays(baseISO: string, days: number): string {
  const d = new Date(baseISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

/** Whole days between two YYYY-MM-DD dates (b - a). */
export function daysBetween(aISO: string, bISO: string): number {
  const a = new Date(aISO + "T00:00:00").getTime();
  const b = new Date(bISO + "T00:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

export function daysSince(dateISO: string | null | undefined, today = todayISO()): number {
  if (!dateISO) return 0;
  return Math.max(0, daysBetween(dateISO.slice(0, 10), today));
}

/**
 * A short relative label like "in 3 days", "today", "2 days ago". Pass the
 * server's `today` from client components so SSR and the browser agree.
 */
export function relativeDay(dateISO: string | null | undefined, today = todayISO()): string {
  if (!dateISO) return "—";
  const diff = daysBetween(today, dateISO.slice(0, 10));
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (diff > 1) return `in ${diff} days`;
  return `${Math.abs(diff)} days ago`;
}

/** Truncate untrusted text before it reaches a paid API or a stored field. */
export function clip(value: string | null | undefined, max: number): string {
  return (value ?? "").slice(0, max);
}

/**
 * Only same-site paths are allowed as a post-login destination. Rejects
 * absolute URLs, protocol-relative `//host`, `/\host`, and whitespace/control
 * characters (browsers strip tabs/newlines, so `/\t/evil.com` becomes
 * `//evil.com`). Anything else would be an open redirect for phishing links.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\") ||
    /[\x00-\x1f\x7f\s]/.test(value)
  ) {
    return fallback;
  }
  return value;
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // Neutralise spreadsheet formula injection (OWASP: = + - @ TAB CR).
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function toCSV(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.map(csvCell).join(",");
  const body = rows
    .map((row) => columns.map((c) => csvCell(row[c])).join(","))
    .join("\r\n");
  return header + "\r\n" + body + "\r\n";
}

/**
 * Form text, trimmed. Browsers send every line break in a textarea as CRLF, so
 * they are put back to plain newlines: text saved from a form then matches the
 * same text saved anywhere else, byte for byte.
 */
function formText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : "";
}

/** Basic non-empty string validation helper for server actions. */
export function requireString(value: FormDataEntryValue | null, field: string): string {
  const s = formText(value);
  if (!s) throw new Error(`${field} is required.`);
  return s;
}

export function optionalString(value: FormDataEntryValue | null): string | null {
  return formText(value) || null;
}

// ---------------------------------------------------------------------------
// Small dependency-free helpers: classnames, formatting, dates and CSV.
// ---------------------------------------------------------------------------

/** Join truthy class names. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

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

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Today's date as YYYY-MM-DD (local time). */
export function todayISO(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

/** Add `days` to a YYYY-MM-DD string (or today) and return YYYY-MM-DD. */
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

export function daysSince(dateISO: string | null | undefined): number {
  if (!dateISO) return 0;
  return Math.max(0, daysBetween(dateISO.slice(0, 10), todayISO()));
}

/** A short relative label like "in 3 days", "today", "2 days ago". */
export function relativeDay(dateISO: string | null | undefined): string {
  if (!dateISO) return "—";
  const diff = daysBetween(todayISO(), dateISO.slice(0, 10));
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (diff > 1) return `in ${diff} days`;
  return `${Math.abs(diff)} days ago`;
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@]/.test(s)) s = "'" + s;
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

/** Basic non-empty string validation helper for server actions. */
export function requireString(value: FormDataEntryValue | null, field: string): string {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) throw new Error(`${field} is required.`);
  return s;
}

export function optionalString(value: FormDataEntryValue | null): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  return s ? s : null;
}

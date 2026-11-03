import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AccessState } from "@/lib/billing";

/** A date in the viewer's own zone ("Oct 30"). */
function day(iso: string | null, timeZone: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone }).format(d);
}

/** "today", "tomorrow" or "on Oct 30", by calendar day in the viewer's zone. */
function when(iso: string | null, timeZone: string, now = new Date()): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "soon";
  const key = (x: Date) => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).format(x);
  if (key(d) === key(now)) return "today";
  if (key(d) === key(new Date(now.getTime() + 86_400_000))) return "tomorrow";
  return `on ${day(iso, timeZone)}`;
}

/**
 * The account's billing situation at the top of every app page, when there is
 * something to say: trial days left, a failed payment, a canceled plan, or
 * read-only. Paid and comped accounts see nothing.
 */
export function BillingBanner({
  state,
  canWrite,
  endsAt,
  daysLeft,
  timeZone,
}: {
  state: AccessState;
  canWrite: boolean;
  endsAt: string | null;
  daysLeft: number | null;
  timeZone: string;
}) {
  let tone: "info" | "warn" | "danger" = "info";
  let text: React.ReactNode = null;
  let action = "See plan";

  if (state === "trial") {
    const left = daysLeft ?? 0;
    // More than three days left: shown quietly in the navigation instead.
    if (left > 3) return null;
    tone = "warn";
    text =
      left <= 1 ? (
        <>Your free trial ends {when(endsAt, timeZone)}. Subscribe to keep adding quotes and following up.</>
      ) : (
        <>Free trial: <span className="font-semibold">{left} days left</span> (until {day(endsAt, timeZone)}).</>
      );
    action = left <= 3 ? "Subscribe" : "See plan";
  } else if (state === "grace") {
    tone = "danger";
    text = (
      <>
        Your last payment didn&apos;t go through. Update your payment details
        {endsAt ? <> by {day(endsAt, timeZone)}</> : null} to keep full access.
      </>
    );
    action = "Update payment";
  } else if (state === "ending") {
    tone = "warn";
    text = <>Your subscription is canceled and ends on {day(endsAt, timeZone)}. Resubscribe any time to keep going.</>;
    action = "Manage";
  } else if (state === "expired") {
    tone = "danger";
    text = canWrite ? (
      <>Your free trial has ended. Subscribe to keep using QuoteLoop.</>
    ) : (
      <>
        <span className="font-semibold">Your account is read-only.</span> Your trial or subscription has ended:
        you can view and export everything, but not add, send or draft. Subscribe to pick up where you left off.
      </>
    );
    action = "Subscribe";
  }

  if (!text) return null;
  return (
    <div
      data-billing-banner
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "ql-fade mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[12px] border px-4 py-3 text-[14px]",
        tone === "info" && "border-line bg-white text-stone-900",
        tone === "warn" && "border-[#F3DFA2] bg-due-50 text-stone-900",
        tone === "danger" && "border-red-200 bg-red-50 text-red-800"
      )}
    >
      <p className="min-w-0 [overflow-wrap:anywhere]">{text}</p>
      <Link href="/settings#billing" className={cn("shrink-0 px-3 py-1.5", tone === "danger" ? "btn-danger" : "btn-primary")}>
        {action}
      </Link>
    </div>
  );
}

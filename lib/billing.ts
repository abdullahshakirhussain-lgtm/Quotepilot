// ---------------------------------------------------------------------------
// Who may use QuoteLoop right now, from their subscription. Pure, so it runs
// the same on the server (enforcement) and in the browser (banners), and can
// be tested without a database.
//
// Read-only means: everything stays visible and exportable, settings and
// deleting your own data still work, but nothing new is created, sent or
// drafted until the account is paid for again.
// ---------------------------------------------------------------------------

export const SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "canceled", "expired", "comped"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export interface SubscriptionRow {
  status: SubscriptionStatus;
  plan?: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  grace_ends_at: string | null;
  cancel_at_period_end?: boolean | null;
  provider?: string | null;
  provider_customer_id?: string | null;
}

/**
 * trial: in the free trial · active: paid · ending: canceled but paid until
 * the period ends · grace: a payment failed, still fully usable for a while ·
 * expired: read-only · comped: free access given by the owner · unknown: the
 * subscription couldn't be read (treated as usable, never as locked).
 */
export type AccessState = "trial" | "active" | "ending" | "grace" | "expired" | "comped" | "unknown";

export interface Access {
  state: AccessState;
  /** May create, send and draft. */
  canWrite: boolean;
  /** When the current state ends (trial end, grace end, paid-until), if it does. */
  endsAt: string | null;
  /** Whole days until endsAt, rounded up (0 when it ends today or has passed). */
  daysLeft: number | null;
}

const DAY = 86_400_000;

function until(endsAt: string | null, now: Date): { open: boolean; daysLeft: number | null } {
  if (!endsAt) return { open: true, daysLeft: null };
  const ms = Date.parse(endsAt) - now.getTime();
  if (Number.isNaN(ms)) return { open: true, daysLeft: null };
  return { open: ms > 0, daysLeft: Math.max(0, Math.ceil(ms / DAY)) };
}

export function accessFrom(sub: SubscriptionRow | null | undefined, now: Date = new Date()): Access {
  // Missing, or not a status QuoteLoop knows: never a reason to lock anyone out.
  if (!sub || typeof sub !== "object" || !(SUBSCRIPTION_STATUSES as readonly string[]).includes(sub.status)) {
    return { state: "unknown", canWrite: true, endsAt: null, daysLeft: null };
  }

  switch (sub.status) {
    case "comped":
      return { state: "comped", canWrite: true, endsAt: null, daysLeft: null };
    case "active": {
      const t = until(sub.current_period_end, now);
      if (sub.cancel_at_period_end && sub.current_period_end) {
        return t.open
          ? { state: "ending", canWrite: true, endsAt: sub.current_period_end, daysLeft: t.daysLeft }
          : { state: "expired", canWrite: false, endsAt: sub.current_period_end, daysLeft: 0 };
      }
      // Activated by hand with an end date: nothing will renew it.
      if (sub.provider === "manual" && sub.current_period_end && !t.open) {
        return { state: "expired", canWrite: false, endsAt: sub.current_period_end, daysLeft: 0 };
      }
      // Past its date otherwise means a renewal notice is late: a paying
      // customer keeps working, but no date in the past is shown.
      return { state: "active", canWrite: true, endsAt: t.open ? sub.current_period_end : null, daysLeft: null };
    }
    case "trialing": {
      const t = until(sub.trial_ends_at, now);
      return t.open
        ? { state: "trial", canWrite: true, endsAt: sub.trial_ends_at, daysLeft: t.daysLeft }
        : { state: "expired", canWrite: false, endsAt: sub.trial_ends_at, daysLeft: 0 };
    }
    case "past_due": {
      const t = until(sub.grace_ends_at, now);
      // No grace date recorded: the provider is still retrying; keep working.
      return t.open
        ? { state: "grace", canWrite: true, endsAt: sub.grace_ends_at, daysLeft: t.daysLeft }
        : { state: "expired", canWrite: false, endsAt: sub.grace_ends_at, daysLeft: 0 };
    }
    case "canceled": {
      const t = sub.current_period_end ? until(sub.current_period_end, now) : { open: false, daysLeft: 0 };
      return t.open
        ? { state: "ending", canWrite: true, endsAt: sub.current_period_end, daysLeft: t.daysLeft }
        : { state: "expired", canWrite: false, endsAt: sub.current_period_end, daysLeft: 0 };
    }
    case "expired":
      return { state: "expired", canWrite: false, endsAt: null, daysLeft: 0 };
    default:
      return { state: "unknown", canWrite: true, endsAt: null, daysLeft: null };
  }
}

/** Shown wherever a read-only account tries to create, send or draft. */
export const READ_ONLY_MESSAGE =
  "Your QuoteLoop subscription isn't active, so your account is read-only for now. Subscribe in Settings to keep adding quotes and following up. Your data is safe: you can still view and export it.";

/** How long a failed payment keeps full access. */
export const GRACE_DAYS = 7;

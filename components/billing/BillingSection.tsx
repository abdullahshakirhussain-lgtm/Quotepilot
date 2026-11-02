import { BillingActions } from "@/components/billing/BillingActions";
import { ForgetReturn, PaymentConfirmed, PaymentPending } from "@/components/billing/PaymentPending";
import { CONTACT_EMAIL, PRICE_LABEL, TRIAL_DAYS } from "@/lib/marketing";
import type { AccessState } from "@/lib/billing";

function day(iso: string | null, timeZone: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone }).format(d);
}

const LABEL: Record<AccessState, string> = {
  trial: "Free trial",
  active: "Active",
  ending: "Canceled",
  grace: "Payment failed",
  expired: "Not active (read-only)",
  comped: "Free access",
  unknown: "Status unavailable",
};

/** Settings → Billing: the plan, where the account stands, and what to do next. */
export function BillingSection({
  state,
  endsAt,
  daysLeft,
  timeZone,
  providerReady,
  hasPaymentAccount,
  justReturned,
}: {
  state: AccessState;
  endsAt: string | null;
  daysLeft: number | null;
  timeZone: string;
  providerReady: boolean;
  hasPaymentAccount: boolean;
  justReturned: boolean;
}) {
  const detail =
    state === "trial"
      ? `${daysLeft ?? 0} day${daysLeft === 1 ? "" : "s"} left · ends ${day(endsAt, timeZone)}`
      : state === "active"
        ? endsAt
          ? `${hasPaymentAccount ? "Renews" : "Active until"} ${day(endsAt, timeZone)}`
          : "Your subscription is active."
        : state === "ending"
          ? `Access until ${day(endsAt, timeZone)}`
          : state === "grace"
            ? endsAt
              ? `Update your payment details by ${day(endsAt, timeZone)} to keep full access.`
              : "Update your payment details to keep full access."
            : state === "expired"
              ? "You can view and export everything. Subscribe to add, send and draft again."
              : state === "comped"
                ? "Your account has free access."
                : "Billing details couldn't be loaded just now. Everything keeps working; check back shortly.";
  const mode = state === "active" || state === "grace" || state === "ending" ? "manage" : "subscribe";
  const showAction = state !== "comped" && state !== "unknown" && !(mode === "manage" && providerReady && !hasPaymentAccount);

  return (
    <section id="billing" className="card scroll-mt-6 p-5">
      <h2 className="text-[15px] font-semibold text-stone-900">Billing</h2>
      <p className="mb-4 mt-0.5 text-sm text-stone-500">
        One plan: {PRICE_LABEL} a month after a {TRIAL_DAYS}-day free trial. No card needed for the trial.
      </p>
      {/* Back from checkout: wait for the provider's notice, confirm it once, then forget it. */}
      {justReturned &&
        (state === "trial" || state === "expired" ? (
          <PaymentPending contactEmail={CONTACT_EMAIL} />
        ) : state === "active" ? (
          <PaymentConfirmed renewsOn={day(endsAt, timeZone)} />
        ) : (
          <ForgetReturn />
        ))}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-stone-900">{LABEL[state]}</p>
          {detail && <p className="mt-0.5 text-sm text-stone-500">{detail}</p>}
        </div>
        {showAction && <BillingActions mode={mode} providerReady={providerReady} contactEmail={CONTACT_EMAIL} />}
      </div>
    </section>
  );
}

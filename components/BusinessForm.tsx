"use client";

import { startTransition, useActionState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import {
  CURRENCIES,
  DEFAULT_FOLLOW_UP_DAYS,
  FOLLOW_UP_DAY_OPTIONS,
  INDUSTRIES,
} from "@/lib/constants";
import type { Business } from "@/lib/types";
import type { ActionState } from "@/app/(app)/settings/actions";
import { reportUnreachable } from "@/lib/form-action";
import { cn } from "@/lib/utils";

export function BusinessForm({
  action,
  initial,
  submitLabel,
  suggested,
  highlightEmail = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: Business | null;
  submitLabel: string;
  /** Prefill for new workspaces (e.g. name and email from Google sign-in). */
  suggested?: { owner_name?: string; email?: string };
  /** Arrived from "Add business email": pick out that field and put the cursor in it. */
  highlightEmail?: boolean;
}) {
  const save = useMemo(() => reportUnreachable(action), [action]);
  const [state, formAction, pending] = useActionState(save, {});
  const selectedDays = initial?.default_follow_up_days ?? DEFAULT_FOLLOW_UP_DAYS;

  return (
    // Submitted by hand rather than with <form action>: React resets a form
    // after its action runs, which would wipe everything typed whenever the
    // server answers with a problem to fix (e.g. a mistyped business email).
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="flex flex-col gap-5"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="business_name" className="label">
            Business name *
          </label>
          <input
            id="business_name"
            name="business_name"
            required
            maxLength={120}
            className="input"
            defaultValue={initial?.business_name ?? ""}
            placeholder="e.g. CoolAir HVAC Services"
          />
        </div>

        <div>
          <label htmlFor="owner_name" className="label">
            Your name *
          </label>
          <input
            id="owner_name"
            name="owner_name"
            required
            maxLength={120}
            className="input"
            defaultValue={initial?.owner_name ?? suggested?.owner_name ?? ""}
            placeholder="e.g. Sam Carter"
          />
        </div>

        <div>
          <label htmlFor="industry" className="label">
            Industry *
          </label>
          <select
            id="industry"
            name="industry"
            className="input"
            defaultValue={initial?.industry ?? INDUSTRIES[0]}
          >
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="currency" className="label">
            Currency *
          </label>
          <select
            id="currency"
            name="currency"
            className="input"
            defaultValue={initial?.currency ?? "USD"}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="phone" className="label">
            Phone (optional)
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            maxLength={40}
            className="input"
            defaultValue={initial?.phone ?? ""}
            placeholder="Include country code"
          />
        </div>

        <div
          id="business-email"
          className={cn("sm:col-span-2", highlightEmail && "-m-3 rounded-lg bg-brand-50 p-3 ring-2 ring-brand-500")}
        >
          <label htmlFor="email" className="label">
            Business email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="input"
            autoFocus={highlightEmail}
            defaultValue={initial?.email ?? suggested?.email ?? ""}
            placeholder="hello@yourbusiness.com"
          />
          <p className="mt-1 text-xs text-stone-500">
            Needed to send emails from QuoteLoop: your customers&apos; replies come here.
          </p>
        </div>
      </div>

      <div>
        <span className="label">Default follow-up schedule</span>
        <p className="mb-2 text-xs text-stone-500">
          Once a quote goes out, QuoteLoop schedules follow-ups on these days
          after it was sent.
        </p>
        <div className="flex flex-wrap gap-2">
          {FOLLOW_UP_DAY_OPTIONS.map((d) => (
            <label
              key={d}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-stone-300 px-3 py-1.5 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
            >
              <input
                type="checkbox"
                name="default_follow_up_days"
                value={d}
                defaultChecked={selectedDays.includes(d)}
                className="accent-brand-600"
              />
              Day {d}
            </label>
          ))}
        </div>
      </div>

      {state.error && (
        <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state.ok && state.message && (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.message}
        </div>
      )}

      <button type="submit" className="btn-primary self-start" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitLabel}
      </button>
    </form>
  );
}

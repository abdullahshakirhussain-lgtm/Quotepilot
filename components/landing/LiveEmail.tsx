"use client";

import { useState } from "react";
import { CURRENCIES } from "@/lib/constants";
import { builtinByKey } from "@/lib/template-library";
import { fillSubject, fillTemplate } from "@/lib/templates";

const FIRST_CHECK_IN = builtinByKey("first_follow_up")!;

/**
 * The page's one live thing: type a real quote on the dark half and read the
 * first follow-up your customer would get on the light half, written by the
 * same template the app uses. Works by thumb on a phone; without script the
 * example as written is shown.
 */
export function LiveEmail() {
  const [customer, setCustomer] = useState("Hannah");
  const [job, setJob] = useState("an illuminated shopfront sign");
  const [amount, setAmount] = useState("2150");
  const [currency, setCurrency] = useState("USD");
  const [business, setBusiness] = useState("Northside Signs");

  const values = {
    customerName: customer.trim() || "there",
    title: job.trim() || "your job",
    amount: Number(amount.replace(/[^\d.]/g, "")) || 0,
    currency,
    businessName: business.trim() || "Your business",
    ownerName: null,
  };
  const subject = fillSubject(FIRST_CHECK_IN.subject, values);
  const body = fillTemplate(FIRST_CHECK_IN.body, values);

  const field =
    "h-10 min-w-0 rounded-none border-0 border-b-2 border-[#5b6470] bg-transparent px-0.5 pb-0.5 text-[var(--lp-light)] outline-none transition-colors focus:border-[#9cc3f2]";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[47fr_53fr]">
      {/* What you hand QuoteLoop: the quote, in your words. */}
      <div className="on-dark bg-[var(--lp-dark)] px-[var(--margin)] py-16 text-[var(--lp-light)] lg:min-h-[90svh] lg:py-24 lg:pr-16">
        <h2 id="try-heading" className="t-h2 max-w-[14ch]" data-reveal>
          Your quote, their inbox
        </h2>
        <form className="t-lead mt-10 max-w-[34ch] leading-[1.75]" data-reveal style={{ ["--i" as string]: 1 }} onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="lv-customer">I quoted </label>
          <input id="lv-customer" className={`${field} w-[6.5ch]`} value={customer} maxLength={40} onChange={(e) => setCustomer(e.target.value)} />{" "}
          <label htmlFor="lv-currency" className="sr-only">
            Currency
          </label>
          <select
            id="lv-currency"
            className={`${field} w-auto cursor-pointer [&>option]:text-black`}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>{" "}
          <label htmlFor="lv-amount" className="sr-only">
            Amount
          </label>
          <input id="lv-amount" inputMode="decimal" className={`${field} num w-[5.5ch]`} value={amount} maxLength={12} onChange={(e) => setAmount(e.target.value)} />{" "}
          <label htmlFor="lv-job">for </label>
          <input id="lv-job" className={`${field} w-full max-w-[24ch]`} value={job} maxLength={80} onChange={(e) => setJob(e.target.value)} />
          <span>. My business is </span>
          <label htmlFor="lv-business" className="sr-only">
            Business name
          </label>
          <input id="lv-business" className={`${field} w-[15ch]`} value={business} maxLength={60} onChange={(e) => setBusiness(e.target.value)} />
          <span>.</span>
        </form>
        <p className="t-small mt-8 max-w-[44ch] text-[var(--lp-light-muted)]" data-reveal style={{ ["--i" as string]: 2 }}>
          Change any of it. The email on the right is written by the same template QuoteLoop uses for a first check-in, and you can make it your own wording.
        </p>
      </div>

      {/* What QuoteLoop makes of it: the email, as the customer reads it. */}
      <div className="bg-[var(--lp-white)] px-[var(--margin)] py-16 lg:min-h-[90svh] lg:py-24 lg:pl-16">
        <figure className="max-w-[520px]" data-ui data-reveal style={{ ["--i" as string]: 1 }} aria-live="polite">
          <figcaption className="sr-only">The follow-up email your customer receives</figcaption>
          <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-y-2 text-[var(--t-small)]">
            <dt className="text-[var(--lp-muted)]">From</dt>
            <dd className="font-semibold [overflow-wrap:anywhere]">{values.businessName} via QuoteLoop</dd>
            <dt className="text-[var(--lp-muted)]">Subject</dt>
            <dd className="[overflow-wrap:anywhere]">{subject}</dd>
          </dl>
          <p className="mt-6 whitespace-pre-wrap text-[var(--t-body)] leading-relaxed [overflow-wrap:anywhere]">{body}</p>
          <p className="t-small mt-6 bg-[var(--lp-paper)] px-4 py-3 text-[var(--lp-muted)]">
            You&apos;re receiving this because you requested a quote from {values.businessName}. Just reply to this email to
            respond.
          </p>
        </figure>
        <ul className="mt-10 max-w-[520px] space-y-3 text-[var(--t-body)]" data-reveal style={{ ["--i" as string]: 2 }}>
          <li>Nothing goes out until you press Send, or copy it to WhatsApp or a text.</li>
          <li>When {values.customerName === "there" ? "they reply" : `${values.customerName} replies`}, the reply comes back to QuoteLoop and to your inbox, and that quote&apos;s reminders pause.</li>
          <li>You answer from QuoteLoop, in the same email thread.</li>
        </ul>
      </div>
    </div>
  );
}

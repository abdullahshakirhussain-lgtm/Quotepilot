// Sections shared by the landing page and the trade pages. Server components
// only: the public pages stay static.

import Link from "next/link";
import { ArrowRight, Check, Mail, Reply } from "lucide-react";
import { CONTACT_EMAIL, FOUNDER, LIMITS, PLAN_INCLUDES, PRICE_LABEL, PRICE_LINE, PRICE_MONTHLY, TRIAL_DAYS } from "@/lib/marketing";

export const h2 = "text-balance text-2xl font-semibold tracking-tight text-stone-950 sm:text-3xl";

/** The main call to action, worded the same everywhere. */
export const START_LABEL = `Start ${TRIAL_DAYS}-day free trial`;

export function MarketingHeader({ onHome = false }: { onHome?: boolean }) {
  // On the landing page the links scroll; elsewhere they go back to it.
  const at = (id: string) => (onHome ? `#${id}` : `/#${id}`);
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
      <Link href="/" className="tap inline-flex items-center text-[15px] font-semibold tracking-tight text-stone-950">
        QuoteLoop
      </Link>
      <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
        <a href={at("how-it-works")} className="btn-ghost hidden md:inline-flex">
          How it works
        </a>
        <a href={at("pricing")} className="btn-ghost hidden sm:inline-flex">
          Pricing
        </a>
        <a href={at("faq")} className="btn-ghost hidden md:inline-flex">
          FAQ
        </a>
        <Link href="/login" className="btn-ghost">
          Log in
        </Link>
        <Link href="/signup" className="btn-primary">
          Start free
        </Link>
      </nav>
    </header>
  );
}

/** Phones only: the sign-up button stays in reach while scrolling. */
export function MobileCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:hidden">
      <Link href="/signup" className="btn-accent w-full justify-center py-2.5 text-base">
        {START_LABEL} <ArrowRight className="h-4 w-4" />
      </Link>
      <p className="mt-1.5 text-center text-xs text-stone-500">Then {PRICE_LABEL}/month. No credit card to start.</p>
    </div>
  );
}

/** A screenshot of the real app in a simple window frame. */
export function Screenshot({
  src,
  alt,
  width,
  height,
  phone = false,
  priority = false,
  className = "",
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  phone?: boolean;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden border border-stone-200 bg-white shadow-xl shadow-stone-900/10 ${phone ? "rounded-[1.75rem] p-1.5" : "rounded-xl"} ${className}`}
    >
      {!phone && (
        <div aria-hidden className="flex gap-1.5 border-b border-stone-200 bg-stone-50 px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-stone-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-stone-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-stone-300" />
        </div>
      )}
      {/* Plain img: the files are already sized WebP, and the public pages stay static. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={`block h-auto w-full ${phone ? "rounded-[1.4rem]" : ""}`}
      />
    </div>
  );
}

const STATS = [
  {
    value: "$30,000",
    label: "a year",
    body: "is what one forgotten $2,500 quote a month adds up to.",
  },
  {
    value: "52",
    label: "quotes a year",
    body: "go unanswered if just one follow-up a week slips through the cracks.",
  },
  {
    value: `$${(PRICE_MONTHLY * 12).toFixed(2)}`,
    label: "a year for QuoteLoop",
    body: "which one small job won back more than pays for.",
  },
  {
    value: "7×",
    label: "more likely",
    body: "to qualify a lead when businesses replied within an hour rather than later.",
    source: {
      label: "Harvard Business Review, 2011",
      href: "https://hbr.org/2011/03/the-short-life-of-online-sales-leads",
    },
  },
];

export function LostQuoteStats() {
  return (
    <section aria-labelledby="lost-quote" className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
      <h2 id="lost-quote" className={h2}>
        What a lost quote really costs
      </h2>
      <p className="mt-3 max-w-2xl leading-relaxed text-stone-600">
        A quote that goes quiet isn&apos;t always a &quot;no&quot;. Often the customer just got busy, and the
        job goes to whoever checks in first.
      </p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => (
          <li key={stat.value} className="card flex flex-col p-5">
            <p className="num text-4xl font-semibold tracking-tight text-stone-950">{stat.value}</p>
            <p className="mt-1 text-sm font-semibold text-brand-700">{stat.label}</p>
            <p className="mt-3 text-sm leading-relaxed text-stone-600">{stat.body}</p>
            {stat.source && (
              <a
                href={stat.source.href}
                target="_blank"
                rel="noopener noreferrer"
                className="tap mt-auto inline-flex items-center self-start pt-1 text-xs text-stone-400 underline-offset-2 hover:text-stone-600 hover:underline"
              >
                Source: {stat.source.label}
              </a>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-stone-400">
        Examples use a $2,500 job. Your numbers will differ, but the sums work the same way.
      </p>
    </section>
  );
}

const TOUR = [
  {
    src: "/screens/follow-ups.webp",
    width: 2560,
    height: 1600,
    alt: "The Follow-ups page: one overdue follow-up, two due today and four coming up, each with Write follow-up and Mark followed up buttons",
    title: "See who to follow up with today",
    body: "Overdue, due today and coming up, in that order. One tap to write the message, one tap to mark it done.",
  },
  {
    src: "/screens/follow-up-writer.webp",
    width: 2560,
    height: 1600,
    alt: "The follow-up writer with a drafted email to Marcus about his AC service quote, and Send email and Copy message buttons",
    title: "A draft in seconds, sent when you say so",
    body: "QuoteLoop writes a first draft from the quote. Edit it, then send it from QuoteLoop or copy it anywhere.",
  },
  {
    src: "/screens/pipeline.webp",
    width: 2880,
    height: 1280,
    alt: "The Pipeline page showing customers by stage, from quote sent to won and lost",
    title: "Know where every job stands",
    body: "Every customer by stage, with what's still waiting and what you've won.",
  },
];

export function ProductTour() {
  return (
    <section id="tour" aria-labelledby="tour-heading" className="border-y border-stone-200 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <h2 id="tour-heading" className={h2}>
          See it in action
        </h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-stone-600">
          Real screens from QuoteLoop, with a made-up business. After you sign up you can load the same kind
          of sample data in one click and try everything before adding your own.
        </p>
        <div className="mt-10 grid gap-12">
          {TOUR.map((item) => (
            <div key={item.src} className="grid items-center gap-6 lg:grid-cols-[1fr_2fr] lg:gap-10">
              <div>
                <h3 className="text-lg font-semibold text-stone-900">{item.title}</h3>
                <p className="mt-2 leading-relaxed text-stone-600">{item.body}</p>
              </div>
              <Screenshot src={item.src} alt={item.alt} width={item.width} height={item.height} />
            </div>
          ))}
          <div className="grid items-center gap-6 sm:grid-cols-[1fr_1fr] lg:grid-cols-[1fr_2fr] lg:gap-10">
            <div>
              <h3 className="text-lg font-semibold text-stone-900">Made for your phone</h3>
              <p className="mt-2 leading-relaxed text-stone-600">
                Follow up from the van or between jobs. QuoteLoop works in your phone&apos;s browser, with every
                page one tap away. Nothing to install.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:max-w-md">
              <Screenshot src="/screens/phone-dashboard.webp" alt="The QuoteLoop home screen on a phone" width={780} height={1688} phone />
              <Screenshot src="/screens/phone-follow-ups.webp" alt="The Follow-ups page on a phone" width={780} height={1688} phone />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** What the customer receives when a follow-up is sent from QuoteLoop. */
export function CustomerEmailPreview() {
  return (
    <section aria-labelledby="customer-sees" className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-16">
      <div>
        <h2 id="customer-sees" className={h2}>
          What your customer receives
        </h2>
        <p className="mt-4 leading-relaxed text-stone-600">
          A plain, personal email with your business name on it, not a newsletter.
        </p>
        <ul className="mt-6 space-y-3 text-stone-700">
          <li className="flex gap-3">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
            It arrives from &quot;Your Business via QuoteLoop&quot;, sent from QuoteLoop&apos;s verified mail domain.
          </li>
          <li className="flex gap-3">
            <Reply className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
            When they reply, it goes straight to your own inbox.
          </li>
          <li className="flex gap-3">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
            One message to one customer, only when you click Send. Up to {LIMITS.emailsPerMonth} a month, or copy the
            message to WhatsApp, text or your own email as often as you like.
          </li>
        </ul>
      </div>
      <figure className="card overflow-hidden text-sm">
        <figcaption className="sr-only">Example of a follow-up email as the customer sees it</figcaption>
        <dl className="divide-y divide-stone-100 border-b border-stone-200 bg-stone-50 text-stone-600">
          <div className="flex gap-3 px-4 py-2">
            <dt className="w-16 shrink-0 text-stone-400">From</dt>
            <dd className="min-w-0 truncate font-medium text-stone-900">Northside Home Services via QuoteLoop</dd>
          </div>
          <div className="flex gap-3 px-4 py-2">
            <dt className="w-16 shrink-0 text-stone-400">Reply to</dt>
            <dd className="min-w-0 truncate">hello@northsidehome.com</dd>
          </div>
          <div className="flex gap-3 px-4 py-2">
            <dt className="w-16 shrink-0 text-stone-400">Subject</dt>
            <dd className="min-w-0 truncate">Following up on your quote: AC service, 3 units</dd>
          </div>
        </dl>
        <div className="space-y-3 px-4 py-4 leading-relaxed text-stone-800">
          <p>Hi Marcus,</p>
          <p>
            Just checking you received our quote for servicing your three AC units. Happy to answer any questions, or
            line up a weekend slot if that&apos;s easier.
          </p>
          <p>
            Best,
            <br />
            Ana Rivera, Northside Home Services
          </p>
          <p className="border-t border-stone-100 pt-3 text-xs text-stone-500">
            You&apos;re receiving this because you requested a quote from Northside Home Services. Just reply to this
            email to respond.
          </p>
        </div>
      </figure>
    </section>
  );
}

export function Pricing() {
  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="border-y border-stone-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:py-20 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16">
        <div>
          <h2 id="pricing-heading" className={h2}>
            One simple price
          </h2>
          <p className="mt-4 max-w-xl leading-relaxed text-stone-600">
            Try everything free for {TRIAL_DAYS} days. No credit card to start, no setup fee and no contract.
          </p>
          <p className="mt-3 max-w-xl leading-relaxed text-stone-600">
            If QuoteLoop helps you win back even one job a month, it has paid for itself many times over.
          </p>
        </div>
        <div className="rounded-xl border-2 border-stone-900 p-6 sm:p-8">
          <p className="text-sm font-semibold text-brand-700">QuoteLoop</p>
          <p className="mt-2 flex items-baseline gap-1.5">
            <span className="num text-5xl font-semibold tracking-tight text-stone-950">{PRICE_LABEL}</span>
            <span className="text-stone-500">/ month</span>
          </p>
          <p className="mt-1 text-sm text-stone-600">{PRICE_LINE}</p>
          <ul className="mt-6 grid gap-2.5 text-sm text-stone-700 sm:grid-cols-2">
            {PLAN_INCLUDES.map((item) => (
              <li key={item} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <Link href="/signup" className="btn-accent mt-7 w-full justify-center px-5 py-2.5 text-base">
            {START_LABEL} <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-center text-xs text-stone-500">No credit card needed to start your trial.</p>
        </div>
      </div>
    </section>
  );
}

export function FounderNote() {
  return (
    <section aria-labelledby="who" className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
      <h2 id="who" className={h2}>
        Who&apos;s behind QuoteLoop
      </h2>
      <p className="mt-4 leading-relaxed text-stone-600">
        QuoteLoop is built and run by {FOUNDER}, an independent developer. It does one job, following up on
        quotes, and it&apos;s built to stay simple, private and fairly priced.
      </p>
      <p className="mt-3 leading-relaxed text-stone-600">
        Questions, ideas or something not working? Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-stone-900 underline underline-offset-2">
          {CONTACT_EMAIL}
        </a>{" "}
        and you&apos;ll hear back from a real person.
      </p>
    </section>
  );
}

export function FinalCta({ heading, body }: { heading: string; body: string }) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
      <div className="rounded-xl bg-stone-950 px-6 py-12 text-center sm:px-12">
        <h2 className="text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">{heading}</h2>
        <p className="mx-auto mt-3 max-w-xl text-balance leading-relaxed text-stone-300">{body}</p>
        <Link href="/signup" className="btn-accent mt-7 px-5 py-2.5 text-base">
          {START_LABEL} <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-4 text-balance text-sm text-stone-400">{PRICE_LINE} No credit card to start.</p>
      </div>
    </section>
  );
}

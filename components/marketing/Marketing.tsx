// Sections shared by the landing page and the trade pages. Server components
// only: the public pages stay static. Same look as the app: white page,
// black-marker rules between sections, condensed display type for headings.

import Link from "next/link";
import { CONTACT_EMAIL, FOUNDER, LIMITS, PLAN_INCLUDES, PRICE_LABEL, PRICE_LINE, PRICE_MONTHLY, TRIAL_DAYS } from "@/lib/marketing";

export const h2 = "text-balance text-[27px] font-semibold leading-tight text-stone-900 sm:text-[34px]";

/** Page width and side gutters, shared by every public section. */
export const wrap = "mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-10";

/** The main call to action, worded the same everywhere. */
export const START_LABEL = `Start ${TRIAL_DAYS}-day free trial`;

/** A section under a black-marker rule. */
export function Band({
  id,
  labelledBy,
  className = "",
  children,
}: {
  id?: string;
  labelledBy?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={`${wrap} ${className}`}>
      <div className="card mb-5 px-5 py-8 sm:px-10 sm:py-12">{children}</div>
    </section>
  );
}

export function MarketingHeader({ onHome = false }: { onHome?: boolean }) {
  // On the landing page the links scroll; elsewhere they go back to it.
  const at = (id: string) => (onHome ? `#${id}` : `/#${id}`);
  const link = "tap hidden items-center px-2 text-[14px] font-medium text-stone-200 hover:text-white lg:px-3";
  return (
    <header className="bg-stone-900 text-white">
      <div className={`${wrap} flex items-center justify-between gap-4 py-3`}>
        <Link href="/" className="tap inline-flex items-center text-[20px] font-bold leading-none text-white">
          QuoteLoop
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <a href={at("how-it-works")} className={`${link} md:inline-flex`}>
            How it works
          </a>
          <a href={at("pricing")} className={`${link} sm:inline-flex`}>
            Pricing
          </a>
          <a href={at("faq")} className={`${link} md:inline-flex`}>
            FAQ
          </a>
          <Link href="/login" className="tap inline-flex items-center px-2 text-[14px] font-medium text-stone-200 hover:text-white">
            Log in
          </Link>
          <Link href="/signup" className="btn tap bg-white py-2.5 text-stone-900 hover:bg-stone-100">
            Start free
          </Link>
        </nav>
      </div>
    </header>
  );
}

/** Phones only: the sign-up button stays in reach while scrolling. */
export function MobileCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:hidden">
      <Link href="/signup" className="btn-primary w-full justify-center py-3 text-base">
        {START_LABEL}
      </Link>
      <p className="mt-1.5 text-center text-[14px] text-stone-600">Then {PRICE_LABEL}/month. No credit card to start.</p>
    </div>
  );
}

/** A screenshot of the real app, framed by a plain black border (no fake window chrome). */
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
      className={`overflow-hidden border border-line bg-white shadow-[0_8px_24px_rgba(16,24,40,0.08)] ${phone ? "rounded-[22px]" : "rounded-[12px]"} ${className}`}
    >
      {/* Plain img: the files are already sized WebP, and the public pages stay static. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="block h-auto w-full"
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

/** The sums, set like lines on a ledger: figure on the left, what it means on the right. */
export function LostQuoteStats() {
  return (
    <Band labelledBy="lost-quote">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <div>
          <h2 id="lost-quote" className={h2}>
            What a lost quote really costs
          </h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-stone-700">
            A quote that goes quiet isn&apos;t always a &quot;no&quot;. Often the customer just got busy, and the job goes
            to whoever checks in first.
          </p>
        </div>
        <div>
          <dl className="divide-y divide-stone-200 border-y border-stone-300">
            {STATS.map((stat) => (
              <div key={stat.value} className="grid grid-cols-1 gap-x-6 gap-y-1 py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-baseline">
                <dt className="num text-[31px] font-semibold leading-none text-stone-900">{stat.value}</dt>
                <dd className="text-base leading-relaxed text-stone-700">
                  <span className="font-semibold text-stone-900">{stat.label}</span> {stat.body}
                  {stat.source && (
                    <>
                      {" "}
                      <a
                        href={stat.source.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tap inline-flex items-center text-[14px] text-stone-600 underline decoration-stone-300 underline-offset-4 hover:text-stone-900 hover:decoration-stone-900"
                      >
                        Source: {stat.source.label}
                      </a>
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[14px] text-stone-600">
            Examples use a $2,500 job. Your numbers will differ, but the sums work the same way.
          </p>
        </div>
      </div>
    </Band>
  );
}

const TOUR = [
  {
    src: "/screens/follow-ups.webp",
    width: 2560,
    height: 1600,
    alt: "The Follow-ups page: overdue, due today and coming up, each with Write follow-up and Mark followed up buttons",
    title: "See who to follow up with today",
    body: "Overdue, due today and coming up, in that order. One tap to write the message, one tap to mark it done.",
  },
  {
    src: "/screens/follow-up-writer.webp",
    width: 2560,
    height: 1600,
    alt: "The follow-up writer with a drafted message to a customer about their quote, and Send email and Copy message buttons",
    title: "A draft in seconds, sent when you say so",
    body: "QuoteLoop writes a first draft from the quote. Edit it, then send it from QuoteLoop or copy it anywhere.",
  },
  {
    src: "/screens/pipeline.webp",
    width: 2560,
    height: 1200,
    alt: "The Pipeline page showing customers by stage, from new to won and lost",
    title: "Know where every job stands",
    body: "Every customer by stage, with what's still waiting and what you've won.",
  },
];

export function ProductTour() {
  return (
    <Band id="tour" labelledBy="tour-heading">
      <h2 id="tour-heading" className={h2}>
        See it in action
      </h2>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-stone-700">
        Real screens from QuoteLoop, with a made-up business. After you sign up you can load the same kind of sample
        data in one click and try everything before adding your own.
      </p>
      <div className="mt-12 grid gap-14">
        {TOUR.map((item) => (
          <div key={item.src} className="grid items-start gap-6 lg:grid-cols-[1fr_2.2fr] lg:gap-12">
            <div className="lg:border-t lg:border-stone-300 lg:pt-4">
              <h3 className="text-[20px] font-semibold leading-tight text-stone-900">{item.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-stone-700">{item.body}</p>
            </div>
            <Screenshot src={item.src} alt={item.alt} width={item.width} height={item.height} />
          </div>
        ))}
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_2.2fr] lg:gap-12">
          <div className="lg:border-t lg:border-stone-300 lg:pt-4">
            <h3 className="text-[20px] font-semibold leading-tight text-stone-900">Made for your phone</h3>
            <p className="mt-2 text-base leading-relaxed text-stone-700">
              Follow up from the van or between jobs. QuoteLoop works in your phone&apos;s browser, with every page one
              tap away. Nothing to install.
            </p>
          </div>
          <div className="grid max-w-lg grid-cols-2 gap-4">
            <Screenshot src="/screens/phone-dashboard.webp" alt="The QuoteLoop home screen on a phone" width={780} height={1688} phone />
            <Screenshot src="/screens/phone-follow-ups.webp" alt="The Follow-ups page on a phone" width={780} height={1688} phone />
          </div>
        </div>
      </div>
    </Band>
  );
}

/** What the customer receives when a follow-up is sent from QuoteLoop. */
export function CustomerEmailPreview() {
  const facts = [
    <>It arrives from &quot;Your Business via QuoteLoop&quot;, sent from QuoteLoop&apos;s verified mail domain.</>,
    <>When they reply, it goes straight to your own inbox.</>,
    <>
      One message to one customer, only when you click Send. Up to {LIMITS.emailsPerMonth} a month, or copy the message
      to WhatsApp, text or your own email as often as you like.
    </>,
  ];
  return (
    <Band labelledBy="customer-sees">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-16">
        <div>
          <h2 id="customer-sees" className={h2}>
            What your customer receives
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-stone-700">
            A plain, personal email with your business name on it, not a newsletter.
          </p>
          <ul className="mt-6 divide-y divide-stone-200 border-y border-stone-300">
            {facts.map((fact, i) => (
              <li key={i} className="py-3 text-base leading-relaxed text-stone-800">
                {fact}
              </li>
            ))}
          </ul>
        </div>
        <figure className="overflow-hidden rounded-[8px] border border-line bg-white text-base">
          <figcaption className="sr-only">Example of a follow-up email as the customer sees it</figcaption>
          <dl className="divide-y divide-stone-200 border-b border-line text-[15px]">
            <div className="flex gap-3 px-4 py-2">
              <dt className="w-20 shrink-0 text-stone-600">From</dt>
              <dd className="min-w-0 font-semibold text-stone-900 [overflow-wrap:anywhere]">Northside Home Services via QuoteLoop</dd>
            </div>
            <div className="flex gap-3 px-4 py-2">
              <dt className="w-20 shrink-0 text-stone-600">Reply to</dt>
              <dd className="min-w-0 text-stone-800 [overflow-wrap:anywhere]">hello@northsidehome.com</dd>
            </div>
            <div className="flex gap-3 px-4 py-2">
              <dt className="w-20 shrink-0 text-stone-600">Subject</dt>
              <dd className="min-w-0 text-stone-800 [overflow-wrap:anywhere]">Following up on your quote: AC service, 3 units</dd>
            </div>
          </dl>
          <div className="space-y-3 px-4 py-5 leading-relaxed text-stone-900">
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
            <p className="border-t border-stone-200 pt-3 text-[14px] text-stone-600">
              You&apos;re receiving this because you requested a quote from Northside Home Services. Just reply to this
              email to respond.
            </p>
          </div>
        </figure>
      </div>
    </Band>
  );
}

export function Pricing() {
  return (
    <Band id="pricing" labelledBy="pricing-heading">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-16">
        <div>
          <h2 id="pricing-heading" className={h2}>
            One simple price
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-stone-700">
            Try everything free for {TRIAL_DAYS} days. No credit card to start, no setup fee and no contract.
          </p>
          <p className="mt-3 max-w-xl text-lg leading-relaxed text-stone-700">
            If QuoteLoop helps you win back even one job a month, it has paid for itself many times over.
          </p>
        </div>
        {/* The plan is a real object, so it gets the one box on the page. */}
        <div className="rounded-[8px] border border-line bg-white p-6 sm:p-8">
          <p className="text-[19px] font-semibold text-stone-900">QuoteLoop</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="num text-[45px] font-semibold leading-none text-stone-900">{PRICE_LABEL}</span>
            <span className="text-lg text-stone-700">a month</span>
          </p>
          <p className="mt-2 text-base text-stone-700">{PRICE_LINE}</p>
          <ul className="mt-6 grid gap-x-6 border-t border-stone-300 text-base text-stone-800 sm:grid-cols-2">
            {PLAN_INCLUDES.map((item) => (
              <li key={item} className="border-b border-stone-200 py-2">
                {item}
              </li>
            ))}
          </ul>
          <Link href="/signup" className="btn-primary mt-7 w-full justify-center py-3 text-base">
            {START_LABEL}
          </Link>
          <p className="mt-3 text-[14px] text-stone-600">No credit card needed to start your trial.</p>
        </div>
      </div>
    </Band>
  );
}

export function FounderNote() {
  return (
    <Band labelledBy="who">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <h2 id="who" className={h2}>
          Who&apos;s behind QuoteLoop
        </h2>
        <div className="max-w-2xl text-lg leading-relaxed text-stone-700">
          <p>
            QuoteLoop is built and run by {FOUNDER}, an independent developer. It does one job, following up on quotes,
            and it&apos;s built to stay simple, private and fairly priced.
          </p>
          <p className="mt-3">
            Questions, ideas or something not working? Email{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-info-700 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>{" "}
            and you&apos;ll hear back from a real person.
          </p>
        </div>
      </div>
    </Band>
  );
}

export function FinalCta({ heading, body }: { heading: string; body: string }) {
  return (
    <Band>
      <div className="max-w-3xl">
        <h2 className="text-balance text-[34px] font-semibold leading-[1.08] text-stone-900 sm:text-[45px]">
          {heading}
        </h2>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-stone-700">{body}</p>
        <Link href="/signup" className="btn-primary mt-7 px-6 py-3 text-base">
          {START_LABEL}
        </Link>
        <p className="mt-3 text-[15px] text-stone-600">{PRICE_LINE} No credit card to start.</p>
      </div>
    </Band>
  );
}

/** Links to the trade pages, as plain underlined words (not pill chips). */
export function TradeLinks({ trades }: { trades: { slug: string; industry: string }[] }) {
  return (
    <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1">
      {trades.map((trade) => (
        <li key={trade.slug}>
          <Link
            href={`/for/${trade.slug}`}
            className="tap inline-flex items-center text-[19px] font-semibold text-stone-900 underline decoration-stone-300 decoration-2 underline-offset-4 hover:decoration-stone-900"
          >
            {trade.industry}
          </Link>
        </li>
      ))}
    </ul>
  );
}

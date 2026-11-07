import type { Metadata } from "next";
import Link from "next/link";
import "./landing.css";
import { LiveEmail } from "@/components/landing/LiveEmail";
import { Reveal } from "@/components/landing/Reveal";
import { SplitStage, type StageScreen } from "@/components/landing/SplitStage";
import { CONTACT_EMAIL, FOUNDER, LIMITS, PRICE_LABEL, PRICE_LINE, PRICE_MONTHLY, SITE_URL, TRADES, TRIAL_DAYS } from "@/lib/marketing";

// Only signed-out visitors see this page: middleware sends anyone signed in
// straight into the app, so it stays static and always offers sign-up.
//
// Direction "the split stage" (taste-skill): the real product holds the fixed
// left half while the reading column scrolls, and the screen changes with the
// section, the way a quote stays in view in QuoteLoop until it's won or lost.
// Styles: app/landing.css. The trade pages keep the shared marketing sections.

const TITLE = "QuoteLoop | Quote follow-up software for small service businesses";
const DESCRIPTION =
  `Track quotes, get follow-up reminders and send AI-drafted follow-ups before quotes go cold. For contractors, cleaners, installers and small service businesses. ${PRICE_LINE}`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: SITE_URL },
  openGraph: { type: "website", url: SITE_URL, siteName: "QuoteLoop", title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const START_LABEL = `Start ${TRIAL_DAYS}-day free trial`;
const days = LIMITS.defaultFollowUpDays.join(", ").replace(/, (\d+)$/, " and $1");

const SCREENS: StageScreen[] = [
  { key: "home", src: "/screens/phone-dashboard.webp", width: 780, height: 1688, alt: "QuoteLoop on a phone: the quotes to follow up now, with the money waiting on them" },
  { key: "add", src: "/screens/dashboard.webp", width: 2560, height: 1600, alt: "The QuoteLoop dashboard: the quotes to follow up today, and open quotes by how long they've waited" },
  { key: "remind", src: "/screens/follow-ups.webp", width: 2560, height: 1600, alt: "The Follow-ups page: overdue, due today and coming up" },
  { key: "write", src: "/screens/follow-up-writer.webp", width: 2560, height: 1600, alt: "The follow-up writer with a drafted message, ready to send or copy" },
  { key: "result", src: "/screens/pipeline.webp", width: 2560, height: 1200, alt: "The Pipeline: every customer by stage, from new to won" },
  { key: "phone", src: "/screens/phone-follow-ups.webp", width: 780, height: 1688, alt: "The Follow-ups page on a phone" },
];

// Every figure is from the source its line links to, except the last, which
// is plain arithmetic on our own price.
const COSTS = [
  {
    figure: "63%",
    text: "of home improvement teams give up on a quote after one or two follow-ups.",
    source: { label: "Hatch, 2024", href: "https://www.usehatchapp.com/blog/state-of-home-improvement-industry-2024" },
  },
  {
    figure: "69%",
    text: "of home service businesses win over half the jobs they quote.",
    source: { label: "Jobber, 2026 report", href: "https://www.getjobber.com/home-service-trends-report/" },
  },
  {
    figure: "7×",
    text: "more likely to qualify a lead when you reply within the hour.",
    source: { label: "Harvard Business Review, 2011", href: "https://hbr.org/2011/03/the-short-life-of-online-sales-leads" },
  },
  {
    figure: `$${(PRICE_MONTHLY * 12).toFixed(2)}`,
    text: `a year for QuoteLoop. One $300 job covers it. A $2,500 job covers ${Math.floor(2500 / (PRICE_MONTHLY * 12))} years.`,
  },
];

const STEPS = [
  { stage: "add", title: "Add the quote you sent.", body: "Send it from QuoteLoop, or add one that went out by email, WhatsApp, text or on paper." },
  { stage: "remind", title: "Then the reminders are set.", body: `Follow-ups fall due ${days} days after sending, or on the days you choose.` },
  { stage: "write", title: "Write it when it's due.", body: "The message for that step is already written. Change the wording, or let the AI draft one." },
  { stage: "result", title: "Mark it won or lost.", body: "Every quote stays in view until then. Changed your mind? Undo it." },
];

const FEATURES = [
  {
    shot: { src: "/screens/follow-ups.webp", w: 960, h: 600, x: 334, y: 172 },
    alt: "Follow-ups grouped into overdue, due today and coming up",
    title: "Every open quote, in view",
    body: ["Overdue, due today and coming up, in that order. Each with one button to write and one to mark it done.", "Quotes you already sent count too: add them with the date they went out."],
  },
  {
    shot: { src: "/screens/follow-up-writer.webp", w: 960, h: 600, x: 410, y: 210 },
    alt: "A follow-up already written, with Send email and Copy message",
    title: "Your wording, or a fresh draft",
    body: ["Ready-made messages for each step, from the first check-in to a thank-you after a win. Edit them once to sound like you.", "Or ask the AI for a draft, then change what you like."],
  },
  {
    shot: null,
    alt: "",
    title: "Replies come back to you",
    body: ["When a customer answers, QuoteLoop shows what they wrote, pauses that quote's reminders and tells you under the bell.", "Answer from QuoteLoop, in the same email thread, or from your own inbox."],
  },
  {
    shot: { src: "/screens/pipeline.webp", w: 960, h: 450, x: 348, y: 172 },
    alt: "Customers by stage in the pipeline",
    title: "Know where every job stands",
    body: ["Every customer by stage, your win rate, and the money still waiting.", "In any currency: amounts in different currencies are never added together."],
  },
  {
    shot: { src: "/screens/phone-follow-ups.webp", w: 390, h: 844, x: 195, y: 262 },
    alt: "The dashboard overview with quotes by status",
    title: "Yours to keep",
    body: ["Works in your phone's browser, nothing to install. Export customers, quotes and follow-ups to CSV whenever you like.", "Your data stays readable even if you stop paying."],
  },
];

const INCLUDED = [
  "Unlimited quotes and customers",
  "Reminders on the schedule you choose",
  `Up to ${LIMITS.emailsPerMonth} emails a month, and replies back in QuoteLoop`,
  "Every message ready to copy to WhatsApp or a text",
];

const FAQS = [
  { q: "How much does QuoteLoop cost?", a: `QuoteLoop is free for ${TRIAL_DAYS} days, then ${PRICE_LABEL} a month. There's one plan with everything included.` },
  { q: "Do I need a credit card to start the free trial?", a: "No. Sign up with your email or Google account and start adding quotes straight away." },
  { q: "What happens when the free trial ends?", a: `QuoteLoop costs ${PRICE_LABEL} a month after the ${TRIAL_DAYS}-day trial. You'll be asked before you're charged anything, and you can export all your data to CSV at any time.` },
  { q: "What is quote follow-up software?", a: "Quote follow-up software helps businesses track sent quotes or estimates, remember when to follow up, and record whether the job was won or lost." },
  { q: "Who is QuoteLoop for?", a: "Small service businesses that send quotes, estimates or proposals: roofers, HVAC companies, plumbers, electricians, cleaners, landscapers, painters, pest control and garage door companies, installers, studios and freelancers." },
  { q: "Can I add quotes I've already sent?", a: "Yes. Add the customer, the job, the amount and the date you sent it, and QuoteLoop schedules the follow-ups from that date." },
  { q: "Does QuoteLoop replace my quoting software or CRM?", a: "No. Keep quoting the way you do now, in Jobber, Housecall Pro, QuickBooks, Word or on paper. QuoteLoop only makes sure the follow-up happens." },
  { q: "Does QuoteLoop send emails automatically?", a: "No. QuoteLoop drafts messages, but nothing is sent until you review it and click Send." },
  { q: "What does my customer see?", a: "A plain email from \"Your Business via QuoteLoop\". When they reply, the reply is forwarded to your own email address and that quote's reminders pause." },
  { q: "How many emails can I send?", a: `Up to ${LIMITS.emailsPerMonth} emails a month (${LIMITS.emailsPerDay} a day) from QuoteLoop. You can copy any message to WhatsApp, text or your own email as often as you like.` },
  { q: "Does it work on my phone?", a: "Yes. QuoteLoop works in your phone's browser, with every page one tap away. There's nothing to install." },
  { q: "Does QuoteLoop access my Gmail?", a: "No. Google sign-in only uses basic profile information for login. QuoteLoop does not access Gmail." },
];

// The same questions and the product, as structured data, built from the text
// above so the two never disagree.
const JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "QuoteLoop",
    url: SITE_URL,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: DESCRIPTION,
    offers: { "@type": "Offer", price: PRICE_MONTHLY.toFixed(2), priceCurrency: "USD", description: PRICE_LINE },
  },
];

// Below the stage, every section keeps the stage's two lines: the heading on
// the page margin, the reading on the column line (47% across, plus 4rem).
const ROW =
  "grid grid-cols-1 gap-10 px-[var(--margin)] lg:grid-cols-[47fr_53fr] lg:gap-0 lg:px-0 lg:[&>:first-child]:pl-[var(--margin)] lg:[&>:last-child]:pr-[var(--margin)]";
const RIGHT = "lg:pl-16";

const i = (n: number) => ({ ["--i" as string]: n }) as React.CSSProperties;
const d = (ms: number) => ({ ["--d" as string]: `${ms}ms` }) as React.CSSProperties;

interface Shot {
  src: string;
  /** The width to draw the whole screen at, and its height at that width. */
  w: number;
  h: number;
  /** The point (at that size) to centre in the window. */
  x: number;
  y: number;
}

/** A window onto one part of a real screen, drawn near its own size so it can be read. */
function Crop({ shot, alt }: { shot: Shot; alt: string }) {
  return (
    <div className="relative h-[220px] w-full overflow-hidden rounded-[var(--radius)] bg-[#e4e7eb]" data-ui>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={shot.src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="absolute max-w-none"
        style={{
          width: shot.w,
          height: shot.h,
          left: `clamp(calc(100% - ${shot.w}px), calc(50% - ${shot.x}px), 0px)`,
          top: `clamp(calc(100% - ${shot.h}px), calc(50% - ${shot.y}px), 0px)`,
        }}
      />
    </div>
  );
}

/** The same screen as the stage shows, for phones (where there is no stage). */
function PhonePicture({ screen }: { screen: StageScreen }) {
  return (
    <div className="mt-8 overflow-hidden rounded-[var(--radius)] bg-[var(--lp-stage)] p-4 lg:hidden" data-ui>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={screen.src} alt={screen.alt} width={screen.width} height={screen.height} loading="lazy" decoding="async" className="mx-auto max-h-[56svh] w-auto" />
    </div>
  );
}
const screen = (key: string) => SCREENS.find((s) => s.key === key)!;

export default function LandingPage() {
  const year = new Date().getFullYear();
  return (
    <main className="lp min-h-svh overflow-x-clip">
      <Reveal />

      <SplitStage screens={SCREENS}>
        {/* The first screen: what it is, what it costs, the one action, and the name. */}
        <section aria-labelledby="hero" data-stage="home" className="on-dark relative flex min-h-svh flex-col bg-[var(--lp-dark)] px-[var(--margin)] pb-8 text-[var(--lp-light)] lg:pl-16 lg:pr-[var(--margin)]">
          <nav aria-label="Main" className="order-first flex items-center whitespace-nowrap justify-end gap-1 pt-4 text-[var(--t-small)] sm:gap-3 lg:pt-6">
            <a href="#how-it-works" className="hidden min-h-11 items-center px-2 text-[var(--lp-light)] hover:text-white md:inline-flex">
              How it works
            </a>
            <a href="#pricing" className="hidden min-h-11 items-center px-2 text-[var(--lp-light)] hover:text-white sm:inline-flex">
              Pricing
            </a>
            <a href="#faq" className="hidden min-h-11 items-center px-2 text-[var(--lp-light)] hover:text-white md:inline-flex lg:hidden xl:inline-flex">
              Questions
            </a>
            <Link href="/login" className="inline-flex min-h-11 items-center px-2 text-[var(--lp-light)] hover:text-white">
              Log in
            </Link>
            <Link href="/signup" className="lp-btn ml-1 min-h-11 px-5 text-[15px]">
              Start free
            </Link>
          </nav>

          {/* The name: under the menu on phones; on wide screens along the bottom,
              set against the right margin and crossing over the stage's edge. */}
          <h1 id="hero" className="wordmark wordmark-move relative z-10 order-first mt-6 flex lg:order-last lg:mt-0 lg:justify-end" data-load style={d(60)}>
            QuoteLoop
          </h1>

          {/* Phones: the product, large. */}
          <div className="mt-6 overflow-hidden rounded-[var(--radius)] bg-[var(--lp-stage)] px-6 pt-6 lg:hidden" data-ui data-load style={d(0)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SCREENS[0].src} alt={SCREENS[0].alt} width={780} height={1688} className="mx-auto h-[44svh] w-auto object-cover object-top" />
          </div>

          <div className="flex flex-1 flex-col justify-center py-10 lg:py-0">
            <p className="t-lead max-w-[24ch] text-[var(--lp-light)]" data-load style={d(120)}>
              Quote follow-up for small service businesses. See which quotes to chase today, with the message already drafted.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3" data-load style={d(240)}>
              <Link href="/signup" className="lp-btn">
                {START_LABEL}
              </Link>
              <p className="t-small text-[var(--lp-light-muted)]">Then {PRICE_LABEL} a month. No credit card to start.</p>
            </div>
          </div>
        </section>

        {/* What a forgotten quote costs: the sums, set quietly. */}
        <section aria-labelledby="cost" data-stage="home" className="px-[var(--margin)] py-28 lg:px-16 lg:py-40">
          <h2 id="cost" className="t-h2 max-w-[16ch]" data-reveal>
            What a forgotten quote costs
          </h2>
          <p className="mt-6 max-w-[46ch]" data-reveal style={i(1)}>
            A quote that goes quiet isn&apos;t always a &quot;no&quot;. Often the customer just got busy, and the job goes to whoever
            checks in first.
          </p>
          {/* The figures lead: a big number, one short line, the source small beneath. */}
          <dl className="mt-14 grid gap-x-12 gap-y-12 sm:grid-cols-2">
            {COSTS.map((c, n) => (
              <div key={c.figure} data-reveal style={i(n + 2)}>
                <dt className="num text-[clamp(52px,5.2vw,76px)] font-semibold leading-none tracking-[-0.02em] text-[var(--lp-ink)]">{c.figure}</dt>
                <dd className="mt-3 max-w-[24ch] text-[19px] leading-snug text-[var(--lp-ink)]">{c.text}</dd>
                <dd className="t-small mt-2 text-[var(--lp-muted)]">
                  {c.source ? (
                    <a href={c.source.href} target="_blank" rel="noopener noreferrer" className="underline decoration-stone-400 underline-offset-4 hover:text-[var(--lp-ink)]">
                      {c.source.label}
                    </a>
                  ) : (
                    <>Plain arithmetic: {PRICE_LABEL} a month</>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* How it works: each statement changes the screen on the stage. */}
        <section id="how-it-works" aria-labelledby="how" className="bg-[var(--lp-white)] px-[var(--margin)] py-28 lg:px-16 lg:py-32">
          <h2 id="how" className="t-h2" data-reveal>
            How it works
          </h2>
          <ol className="mt-10">
            {STEPS.map((s) => (
              <li key={s.stage} data-stage={s.stage} className="step flex flex-col justify-center py-10 lg:min-h-[62vh]" data-reveal>
                <h3 className="t-lead max-w-[22ch] font-semibold">{s.title}</h3>
                <p className="mt-3 max-w-[44ch]">{s.body}</p>
                <PhonePicture screen={screen(s.stage)} />
              </li>
            ))}
          </ol>
        </section>

        {/* What's included: each with a small piece of the real screen as proof. */}
        <section aria-labelledby="included" data-stage="phone" className="px-[var(--margin)] py-28 lg:px-16 lg:py-40">
          <h2 id="included" className="t-h2 max-w-[18ch]" data-reveal>
            What you get
          </h2>
          <div className="mt-16 grid gap-24">
            {FEATURES.map((f) => (
              <div key={f.title} className="grid max-w-[640px] gap-5 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]" data-reveal>
                {f.shot ? <Crop shot={f.shot} alt={f.alt} /> : <div aria-hidden className="hidden xl:block" />}
                <div>
                  <h3 className="text-[var(--t-body)] font-semibold leading-snug">{f.title}</h3>
                  {f.body.map((p) => (
                    <p key={p} className="mt-2 text-[var(--lp-muted)]">
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Keep quoting your way: the trade pages. */}
        <section aria-labelledby="your-way" data-stage="result" className="bg-[var(--lp-white)] px-[var(--margin)] py-28 lg:px-16 lg:py-32">
          <h2 id="your-way" className="t-h2 max-w-[16ch]" data-reveal>
            Keep quoting your way
          </h2>
          <p className="mt-6 max-w-[46ch]" data-reveal style={i(1)}>
            QuoteLoop doesn&apos;t replace your quoting tool. Quote in Jobber, Housecall Pro, QuickBooks, Word or on paper, then
            add the quote here so the follow-up happens. No invoices, schedules or campaigns to set up.
          </p>
          <p className="mt-10 font-semibold" data-reveal style={i(2)}>
            See how it works for your trade:
          </p>
          <ul className="mt-3 grid max-w-[46ch] grid-cols-2 gap-x-8" data-reveal style={i(3)}>
            {TRADES.map((t) => (
              <li key={t.slug}>
                <Link href={`/for/${t.slug}`} className="lp-link inline-flex min-h-11 items-center text-[var(--t-lead)] font-medium">
                  {t.industry}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </SplitStage>

      {/* The live thing: your quote on the dark half, their email on the light half. */}
      <section aria-labelledby="try-heading">
        <LiveEmail />
      </section>

      {/* The price, very large. */}
      <section id="pricing" aria-labelledby="pricing-heading" className={`${ROW} min-h-[80svh] items-center py-28`}>
        <div>
          <h2 id="pricing-heading" className="t-h2" data-reveal>
            One simple price
          </h2>
          <p className="mt-6 max-w-[34ch]" data-reveal style={i(1)}>
            Try everything free for {TRIAL_DAYS} days. No credit card to start, no setup fee and no contract. One job won back
            pays for a year.
          </p>
        </div>
        <div className={RIGHT} data-reveal style={i(1)}>
          <p className="flex items-baseline font-semibold leading-[0.85] tracking-[-0.05em]">
            <span className="num text-[length:var(--t-display)]">{PRICE_LABEL}</span>
            <span className="ml-3 text-[var(--t-body)] font-normal tracking-normal text-[var(--lp-muted)]">a month</span>
          </p>
          <ul className="mt-10 space-y-2">
            {INCLUDED.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <Link href="/signup" className="lp-btn mt-9">
            {START_LABEL}
          </Link>
        </div>
      </section>

      {/* From the person who built it, as a short letter on the reading line. */}
      <section aria-labelledby="who" className={`${ROW} bg-[var(--lp-white)] py-40`}>
        <h2 id="who" className="t-h2 max-w-[12ch]" data-reveal>
          Who&apos;s behind QuoteLoop
        </h2>
        <div className={`${RIGHT} max-w-[calc(520px+4rem)]`}>
          <div className="space-y-5" data-reveal style={i(1)}>
            <p>I&apos;m {FOUNDER}, and I build and run QuoteLoop on my own.</p>
            <p>It does one job: making sure the quotes you send get followed up, so the work doesn&apos;t go to whoever happened to call back first.</p>
            <p>It stays simple on purpose. Nothing emails your customers behind your back, there&apos;s nothing to install, and it&apos;s priced fairly.</p>
            <p>
              If something isn&apos;t working, or you want something it doesn&apos;t do, email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="lp-link">
                {CONTACT_EMAIL}
              </a>
              . You&apos;ll hear back from me.
            </p>
          </div>
          <p className="t-lead mt-8 font-medium" data-reveal style={i(2)}>
            {FOUNDER}
          </p>
          <p className="t-small text-[var(--lp-muted)]">Builds and runs QuoteLoop</p>
        </div>
      </section>

      {/* Questions, answered as reading text on the reading line. */}
      <section id="faq" aria-labelledby="faq-heading" className={`${ROW} py-28 lg:py-36`}>
        <h2 id="faq-heading" className="t-h2" data-reveal>
          Questions
        </h2>
        <div className={`${RIGHT} faq-text max-w-[calc(64ch+4rem)]`} data-reveal style={i(1)}>
          {FAQS.map(({ q, a }) => (
            <p key={q}>
              <strong className="font-semibold">{q}</strong> {a}
            </p>
          ))}
        </div>
      </section>
      <script
        type="application/ld+json"
        // Static text; "<" is escaped so the JSON can never close the tag early.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }}
      />

      {/* A plain sentence, one action. */}
      <section aria-labelledby="last" className="px-[var(--margin)] pb-[16svh] pt-[22svh]">
        <h2 id="last" className="t-lead max-w-[34ch] font-normal" data-reveal>
          Add the quote you sent this week, and QuoteLoop will tell you when to follow up.
        </h2>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3" data-reveal style={i(1)}>
          <Link href="/signup" className="lp-btn">
            {START_LABEL}
          </Link>
          <p className="t-small text-[var(--lp-muted)]">{PRICE_LINE} No credit card to start.</p>
        </div>
      </section>

      {/* A single quiet line. */}
      <footer className={`${ROW} gap-2 pb-8 text-[var(--t-small)] text-[var(--lp-muted)] lg:items-baseline`}>
        <p>
          © {year} QuoteLoop. Quote follow-up for small service businesses.
        </p>
        <nav aria-label="Site" className={`${RIGHT} flex flex-wrap gap-x-6`}>
          <a href="#pricing" className="inline-flex min-h-11 items-center text-[var(--lp-ink)] hover:underline">
            Pricing
          </a>
          <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex min-h-11 items-center text-[var(--lp-ink)] hover:underline">
            Contact
          </a>
          <Link href="/privacy" className="inline-flex min-h-11 items-center text-[var(--lp-ink)] hover:underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="inline-flex min-h-11 items-center text-[var(--lp-ink)] hover:underline">
            Terms of Service
          </Link>
          <Link href="/refunds" className="inline-flex min-h-11 items-center text-[var(--lp-ink)] hover:underline">
            Refund Policy
          </Link>
        </nav>
      </footer>
    </main>
  );
}

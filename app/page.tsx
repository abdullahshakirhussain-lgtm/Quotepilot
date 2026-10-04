import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Check,
  ClipboardList,
  Coins,
  Download,
  KanbanSquare,
  Send,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import {
  CustomerEmailPreview,
  FinalCta,
  FounderNote,
  h2,
  LostQuoteStats,
  MarketingHeader,
  MobileCta,
  Pricing,
  ProductTour,
  Screenshot,
  START_LABEL,
} from "@/components/marketing/Marketing";
import { LIMITS, PRICE_LABEL, PRICE_LINE, PRICE_MONTHLY, SITE_URL, TRADES, TRIAL_DAYS } from "@/lib/marketing";

// Only signed-out visitors see this page: middleware sends anyone signed in
// straight into the app, so it stays static and always offers sign-up.

const TITLE = "QuoteLoop — Quote Follow-Up Software for Small Service Businesses";
const DESCRIPTION =
  `Track quotes, get follow-up reminders and send AI-drafted follow-ups before quotes go cold. For contractors, cleaners, installers and small service businesses. ${PRICE_LINE}`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "QuoteLoop",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const HIGHLIGHTS = [
  { icon: BellRing, text: "Reminders for every open quote" },
  { icon: Sparkles, text: "AI drafts, you review" },
  { icon: Send, text: "Send from QuoteLoop or copy" },
  { icon: Trophy, text: "Track won and lost work" },
];

const STEPS = [
  {
    title: "Add or send a quote",
    body: "Send a quote email from QuoteLoop, or add one you already sent from your own email, app or paper pad.",
  },
  {
    title: "Reminders are scheduled",
    body: `Follow-ups are set for days ${LIMITS.defaultFollowUpDays.join(", ").replace(/, (\d+)$/, " and $1")} after sending, or the schedule you choose.`,
  },
  {
    title: "Write the follow-up",
    body: "Get an AI draft that fits the stage of the quote, edit it, then send it or copy it.",
  },
  {
    title: "Mark the result",
    body: "Mark each quote won or lost. Changed your mind? Undo it.",
  },
];

const FEATURES = [
  {
    icon: ClipboardList,
    title: "Quote tracking",
    body: "Every sent quote in one place, instead of scattered across email, WhatsApp, notes or memory.",
  },
  {
    icon: BellRing,
    title: "Follow-up reminders",
    body: "See what needs attention today, what's overdue and what's coming up. You choose the schedule.",
  },
  {
    icon: Sparkles,
    title: "The right message for each stage",
    body: "Drafts for a first check-in, a second nudge, a last call, a price that's about to expire, or a thank-you after a win.",
  },
  {
    icon: Send,
    title: "Send or copy",
    body: "Send a reviewed email from QuoteLoop, or copy the message into WhatsApp, a text or your own email.",
  },
  {
    icon: Trophy,
    title: "Won/lost tracking",
    body: "See which quotes turned into jobs, your win rate and the value still waiting.",
  },
  {
    icon: KanbanSquare,
    title: "Pipeline",
    body: "Every customer by stage, from quote sent to won, so nothing sits forgotten in the middle.",
  },
  {
    icon: Users,
    title: "Customer list",
    body: "Names, emails and phone numbers with their quotes, ready when you need to call back.",
  },
  {
    icon: Coins,
    title: "Any currency",
    body: "Quote in your own currency. Amounts in different currencies are never added together.",
  },
  {
    icon: Download,
    title: "CSV export",
    body: "Your data is yours. Export customers, quotes and follow-ups whenever you like.",
  },
];

const YOU_DECIDE = [
  "You review every draft",
  "You edit it before it goes out",
  "You click send, or copy it instead",
  "No automatic sequences",
];

const FAQS = [
  {
    q: "How much does QuoteLoop cost?",
    a: `QuoteLoop is free for ${TRIAL_DAYS} days, then ${PRICE_LABEL} a month. There's one plan with everything included.`,
  },
  {
    q: "Do I need a credit card to start the free trial?",
    a: "No. Sign up with your email or Google account and start adding quotes straight away.",
  },
  {
    q: "What happens when the free trial ends?",
    a: `QuoteLoop costs ${PRICE_LABEL} a month after the ${TRIAL_DAYS}-day trial. You'll be asked before you're charged anything, and you can export all your data to CSV at any time.`,
  },
  {
    q: "What is quote follow-up software?",
    a: "Quote follow-up software helps businesses track sent quotes or estimates, remember when to follow up, and record whether the job was won or lost.",
  },
  {
    q: "Who is QuoteLoop for?",
    a: "Small service businesses that send quotes, estimates or proposals: roofers, HVAC companies, plumbers, electricians, cleaners, landscapers, painters, pest control and garage door companies, installers, studios and freelancers.",
  },
  {
    q: "Can I add quotes I've already sent?",
    a: "Yes. Add the customer, the job, the amount and the date you sent it, and QuoteLoop schedules the follow-ups from that date.",
  },
  {
    q: "Does QuoteLoop replace my quoting software or CRM?",
    a: "No. Keep quoting the way you do now, in Jobber, Housecall Pro, QuickBooks, Word or on paper. QuoteLoop only makes sure the follow-up happens.",
  },
  {
    q: "Does QuoteLoop send emails automatically?",
    a: "No. QuoteLoop drafts messages, but nothing is sent until you review it and click Send.",
  },
  {
    q: "What does my customer see?",
    a: "A plain email from \"Your Business via QuoteLoop\". When they reply, the reply goes to your own email address.",
  },
  {
    q: "How many emails can I send?",
    a: `Up to ${LIMITS.emailsPerMonth} emails a month (${LIMITS.emailsPerDay} a day) from QuoteLoop. You can copy any message to WhatsApp, text or your own email as often as you like.`,
  },
  {
    q: "Does it work on my phone?",
    a: "Yes. QuoteLoop works in your phone's browser, with every page one tap away. There's nothing to install.",
  },
  {
    q: "Does QuoteLoop access my Gmail?",
    a: "No. Google sign-in only uses basic profile information for login. QuoteLoop does not access Gmail.",
  },
];

// The same questions and the product, as structured data, built from the text
// above so the two never disagree.
const JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "QuoteLoop",
    url: SITE_URL,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: DESCRIPTION,
    offers: {
      "@type": "Offer",
      price: PRICE_MONTHLY.toFixed(2),
      priceCurrency: "USD",
      description: PRICE_LINE,
    },
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen pb-24 sm:pb-0">
      <MarketingHeader onHome />

      {/* grid-cols-1 (minmax(0, 1fr)) lets the column shrink to the screen. */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1fr_1.15fr] lg:pt-16">
        <div>
          <p className="text-sm font-semibold text-brand-700">Quote follow-up software for small service businesses</p>
          <h1 className="mt-3 text-balance text-[2.25rem] font-semibold leading-[1.08] tracking-tight text-stone-950 sm:text-5xl lg:text-[3.4rem]">
            Win more of the jobs you quote
          </h1>
          <p className="mt-5 max-w-xl text-lg text-stone-600">
            QuoteLoop reminds you which quotes to chase, drafts the follow-up for you, and keeps every open quote in
            view until it&apos;s won or lost.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="btn-accent px-5 py-2.5 text-base">
              {START_LABEL} <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#tour" className="btn-secondary px-5 py-2.5 text-base">
              See it in action
            </a>
          </div>
          <p className="mt-4 text-sm text-stone-500">
            {PRICE_LINE} No credit card to start.
          </p>
        </div>
        <Screenshot
          src="/screens/dashboard.webp"
          alt="The QuoteLoop dashboard: 3 follow-ups need attention, $19,140 waiting in open quotes, and a list of customers to follow up with"
          width={2560}
          height={1600}
          priority
        />
      </section>

      <div className="border-y border-stone-200 bg-white">
        <ul className="mx-auto grid max-w-6xl gap-x-8 gap-y-4 px-6 py-6 sm:grid-cols-2 lg:grid-cols-4">
          {HIGHLIGHTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2.5 text-sm font-medium text-stone-800">
              <Icon className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
              {text}
            </li>
          ))}
        </ul>
      </div>

      <LostQuoteStats />

      <section id="how-it-works" className="border-y border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <h2 className={h2}>How QuoteLoop works</h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-stone-600">
            Every open quote stays visible until it&apos;s won, lost or followed up.
          </p>
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4 sm:block">
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700 ring-1 ring-brand-200"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="mt-1 font-semibold text-stone-900 sm:mt-4">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <ProductTour />

      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <h2 className={h2}>Everything you need to follow up, nothing you don&apos;t</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card p-5">
              <Icon className="h-5 w-5 text-brand-600" aria-hidden />
              <h3 className="mt-3 font-semibold text-stone-900">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="border-y border-stone-200 bg-white">
        <CustomerEmailPreview />
      </div>

      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16">
        <section>
          <h2 className={h2}>Keep quoting the way you do now</h2>
          <p className="mt-4 leading-relaxed text-stone-600">
            QuoteLoop doesn&apos;t replace your quoting tool. Quote in Jobber, Housecall Pro, QuickBooks, Word, Excel or
            on paper, then add the quote to QuoteLoop so the follow-up happens.
          </p>
          <p className="mt-3 leading-relaxed text-stone-600">
            There are no invoices, job schedules or email campaigns to set up. If your follow-ups live in a notebook, a
            spreadsheet or your head, QuoteLoop is the simple step up.
          </p>
        </section>
        <section>
          <h2 className={h2}>Built for businesses that send quotes</h2>
          <p className="mt-4 leading-relaxed text-stone-600">
            For any small business that gives prices, estimates or proposals, including installers, studios and
            freelancers. See how it works for your trade:
          </p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {TRADES.map((trade) => (
              <li key={trade.slug}>
                <Link
                  href={`/for/${trade.slug}`}
                  className="tap inline-flex items-center rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:border-stone-400 hover:text-stone-950"
                >
                  {trade.industry}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <h2 className={h2}>AI drafts. You decide what gets sent.</h2>
            <p className="mt-4 max-w-xl leading-relaxed text-stone-600">
              QuoteLoop writes a follow-up draft from the quote, the customer and your business details. You edit it
              before it goes anywhere. Nothing is sent automatically.
            </p>
          </div>
          <ul className="card divide-y divide-stone-100 px-5 py-1">
            {YOU_DECIDE.map((line) => (
              <li key={line} className="flex items-start gap-3 py-3.5 text-stone-800">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Pricing />

      <FounderNote />

      <section id="faq" className="border-y border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <h2 className={h2}>Questions</h2>
          <div className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
            {FAQS.map(({ q, a }) => (
              <div key={q}>
                <h3 className="font-semibold text-stone-900">{q}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <script
        type="application/ld+json"
        // Static text; "<" is escaped so the JSON can never close the tag early.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }}
      />

      <FinalCta
        heading="Stop letting quotes disappear quietly"
        body="Add your next quote, schedule the follow-up, and keep it in view until it's won or lost."
      />

      <SiteFooter />
      <MobileCta />
    </main>
  );
}

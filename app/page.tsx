import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Check,
  ClipboardList,
  Download,
  FileText,
  Send,
  Sparkles,
  Trophy,
} from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";

// Only signed-out visitors see this page: middleware sends anyone signed in
// straight into the app, so it stays static and always offers sign-up.

const SITE_URL = "https://quoteloop.site";
const TITLE = "QuoteLoop — Quote Follow-Up Software for Small Service Businesses";
const DESCRIPTION =
  "Track quotes, get follow-up reminders, draft AI emails, and follow up with customers before quotes go cold. Built for contractors, cleaners, installers and small service businesses.";

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
};

const HIGHLIGHTS = [
  { icon: FileText, text: "Built for quotes and estimates" },
  { icon: Sparkles, text: "AI drafts, you review" },
  { icon: Send, text: "Send from QuoteLoop or copy" },
  { icon: Trophy, text: "Track won and lost work" },
];

const STEPS = [
  {
    title: "Add or send a quote",
    body: "Create a quote email in QuoteLoop, or track a quote you already sent elsewhere.",
  },
  {
    title: "Reminders are scheduled",
    body: "QuoteLoop shows when each quote needs attention, including overdue follow-ups.",
  },
  {
    title: "Write the follow-up",
    body: "Use an AI draft, edit it, then send from QuoteLoop or copy the message.",
  },
  {
    title: "Mark the result",
    body: "Mark each quote won, lost or still waiting.",
  },
];

const FEATURES = [
  {
    icon: ClipboardList,
    title: "Quote tracking",
    body: "Keep sent quotes in one place instead of scattered across email, WhatsApp, notes or memory.",
  },
  {
    icon: BellRing,
    title: "Follow-up reminders",
    body: "See which quotes need attention today, which are overdue, and what's coming up.",
  },
  {
    icon: Sparkles,
    title: "AI follow-up drafts",
    body: "Get a first draft for the message, then review and edit it before sending.",
  },
  {
    icon: Send,
    title: "Send or copy",
    body: "Send reviewed emails from QuoteLoop, or copy the message into your own email or phone.",
  },
  {
    icon: Trophy,
    title: "Won/lost tracking",
    body: "See which quotes turned into jobs and which ones were lost.",
  },
  {
    icon: Download,
    title: "CSV export",
    body: "Export your customers, quotes and follow-ups when you need the data.",
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
    q: "What is quote follow-up software?",
    a: "Quote follow-up software helps businesses track sent quotes or estimates, remember when to follow up, and record whether the job was won or lost.",
  },
  {
    q: "Who is QuoteLoop for?",
    a: "QuoteLoop is for small service businesses that send quotes, estimates or proposals, including contractors, cleaners, installers, studios and freelancers.",
  },
  {
    q: "Can I use QuoteLoop for estimates?",
    a: "Yes. If your business calls them estimates, quotes or proposals, QuoteLoop can help you track them and follow up.",
  },
  {
    q: "Does QuoteLoop send emails automatically?",
    a: "No. QuoteLoop can draft messages and send reviewed emails, but you choose when to send each one.",
  },
  {
    q: "Does QuoteLoop replace a CRM?",
    a: "No. QuoteLoop is simpler than a full CRM. It focuses on quote tracking, reminders, follow-ups and won/lost status.",
  },
  {
    q: "Can I copy messages instead of sending from QuoteLoop?",
    a: "Yes. You can copy a follow-up message and send it through your own email, WhatsApp, text or another channel.",
  },
  {
    q: "Does QuoteLoop use AI?",
    a: "Yes. QuoteLoop can draft follow-up messages. You review and edit them before sending.",
  },
  {
    q: "Does QuoteLoop access my Gmail?",
    a: "No. Google sign-in only uses basic profile information for login. QuoteLoop does not access Gmail.",
  },
];

// The same questions as structured data, built from the text above so the two
// never disagree.
const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

const h2 = "text-balance text-2xl font-semibold tracking-tight text-stone-950 sm:text-3xl";

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
          QuoteLoop
        </div>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost">
            Log in
          </Link>
          <Link href="/signup" className="btn-primary">
            Start free
          </Link>
        </nav>
      </header>

      {/* grid-cols-1 (minmax(0, 1fr)) lets the column shrink to the screen, so
          the preview's long one-line rows truncate instead of widening the page. */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1fr_1.05fr] lg:pt-16">
        <div>
          <h1 className="text-balance text-[2rem] font-semibold leading-[1.1] tracking-tight text-stone-950 sm:text-5xl lg:text-[3.25rem]">
            Quote <span className="whitespace-nowrap">follow-up</span> software for small service
            businesses
          </h1>
          <p className="mt-5 max-w-xl text-lg text-stone-600">
            Track sent quotes, get follow-up reminders, draft better emails, and follow up before
            customers go cold.
          </p>
          <p className="mt-3 max-w-xl font-medium text-stone-800">
            You already sent the quote. QuoteLoop helps make sure you don&apos;t forget the
            follow-up.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="btn-accent px-5 py-2.5 text-base">
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#how-it-works" className="btn-secondary px-5 py-2.5 text-base">
              See how it works
            </a>
          </div>
          <p className="mt-4 text-sm text-stone-500">
            For contractors, cleaners, installers, studios and freelancers. No credit card.
          </p>
        </div>

        {/* Static product preview, matching the real dashboard */}
        <figure className="rounded-xl border border-stone-200 bg-white p-2 shadow-xl shadow-stone-900/10">
          <figcaption className="sr-only">
            Example of the QuoteLoop dashboard with sample quotes
          </figcaption>
          <div className="rounded-lg bg-stone-950 p-5 text-stone-300">
            <p className="text-xs text-stone-500">Today</p>
            <p className="mt-1 text-xl font-semibold text-white">2 follow-ups need attention</p>
            <p className="text-sm">
              <span className="text-red-400">1 overdue</span> ·{" "}
              <span className="text-brand-400">1 due today</span>
            </p>
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">
                Waiting in open quotes
              </p>
              <p className="num mt-1 text-3xl font-semibold text-white">$8,330.00</p>
            </div>
          </div>
          <ul className="divide-y divide-stone-100 px-2 py-1 text-sm">
            {[
              { who: "Hannah Brooks", what: "Shopfront sign", when: "Overdue", dot: "bg-red-500", tone: "text-red-700" },
              { who: "Marcus Reed", what: "AC servicing", when: "Due today", dot: "bg-brand-500", tone: "text-brand-700" },
              { who: "Priya Nair", what: "Living room redesign", when: "Due tomorrow", dot: "bg-stone-300", tone: "text-stone-500" },
            ].map((r) => (
              <li key={r.who} className="flex items-center gap-3 py-2.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${r.dot}`} />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-stone-900">{r.who}</span>
                  <span className="text-stone-500"> · {r.what}</span>
                </span>
                <span className={`whitespace-nowrap text-xs font-medium ${r.tone}`}>{r.when}</span>
              </li>
            ))}
          </ul>
          <div className="m-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-stone-500">
              <Sparkles className="h-3.5 w-3.5 text-brand-600" /> Draft for Marcus
            </p>
            <p className="mt-1.5 leading-relaxed">
              Hi Marcus, just checking you received our quote for servicing your three
              AC units. Happy to line up a weekend slot if that&apos;s easier.
            </p>
          </div>
        </figure>
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

      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:py-20 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-16">
        <div>
          <h2 className={h2}>Quotes go cold when follow-up is forgotten</h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-stone-600">
            Small service businesses send prices every day. Some customers reply quickly. Others
            compare options, get busy, or simply go quiet. If the quote isn&apos;t followed up, the
            job can disappear.
          </p>
          <p className="mt-3 max-w-2xl leading-relaxed text-stone-600">
            QuoteLoop keeps every open quote in one place, shows what needs attention, and helps
            you follow up at the right time.
          </p>
        </div>
        <p className="text-balance border-l-4 border-brand-500 pl-5 text-2xl font-semibold leading-snug tracking-tight text-stone-900">
          Every quote you send is money waiting for a follow-up.
        </p>
      </section>

      <section id="how-it-works" className="border-y border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <h2 className={h2}>How QuoteLoop works</h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-stone-600">
            QuoteLoop keeps open quotes visible until they&apos;re won, lost or followed up.
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

      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <h2 className={h2}>Everything focused on quote follow-up</h2>
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
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16">
          <section>
            <h2 className={h2}>Built for service businesses that send quotes</h2>
            <p className="mt-4 leading-relaxed text-stone-600">
              QuoteLoop is useful for small businesses that give prices, estimates or proposals and
              need a simple way to follow up.
            </p>
            <p className="mt-3 leading-relaxed text-stone-600">
              Contractors, HVAC and AC repair companies, roofers, painters, cleaners, landscapers,
              pest control companies, garage door repair businesses, plumbers, electricians,
              installers, studios and freelancers can use QuoteLoop to track quotes and follow up
              without a heavy CRM.
            </p>
          </section>
          <section>
            <h2 className={h2}>Not another heavy CRM</h2>
            <p className="mt-4 leading-relaxed text-stone-600">
              QuoteLoop is intentionally simple. It doesn&apos;t try to manage your whole business.
              It focuses on one job: helping you follow up on quotes until each one is won, lost or
              closed.
            </p>
            <p className="mt-3 leading-relaxed text-stone-600">
              There are no invoices, job schedules or email campaigns to set up. If your quote
              reminders live in a notebook, a spreadsheet or your head, QuoteLoop is the simple step
              up.
            </p>
          </section>
        </div>
      </div>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div>
          <h2 className={h2}>AI drafts. You decide what gets sent.</h2>
          <p className="mt-4 max-w-xl leading-relaxed text-stone-600">
            QuoteLoop can write a follow-up draft based on the quote, customer and business
            details. You can edit the message before sending. Nothing is sent automatically.
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
      </section>

      <section id="faq" className="border-y border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <h2 className={h2}>Questions about quote follow-up software</h2>
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD).replace(/</g, "\\u003c") }}
      />

      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="rounded-xl bg-stone-950 px-6 py-12 text-center sm:px-12">
          <h2 className="text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Stop letting quotes disappear quietly
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-balance leading-relaxed text-stone-300">
            Add your next quote, schedule the follow-up, and keep it visible until it&apos;s won or
            lost.
          </p>
          <Link href="/signup" className="btn-accent mt-7 px-5 py-2.5 text-base">
            Start free <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-4 text-balance text-sm text-stone-400">
            No heavy CRM setup. No automatic email sequences.
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

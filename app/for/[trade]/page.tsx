import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BellRing, Check, Send, Sparkles, Trophy } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import {
  CustomerEmailPreview,
  FinalCta,
  h2,
  LostQuoteStats,
  MarketingHeader,
  MobileCta,
  Pricing,
  Screenshot,
  START_LABEL,
} from "@/components/marketing/Marketing";
import { PRICE_LINE, SITE_URL, TRADES, tradeBySlug } from "@/lib/marketing";

// One static page per trade, built at deploy time; any other slug is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return TRADES.map((trade) => ({ trade: trade.slug }));
}

type Props = { params: Promise<{ trade: string }> };

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const trade = tradeBySlug((await params).trade);
  if (!trade) return {};
  const title = `Quote Follow-Up Software for ${capitalize(trade.plural)} | QuoteLoop`;
  const description = `Follow up on every quote before it goes cold. Reminders, AI-drafted follow-ups and won/lost tracking for ${trade.plural}. ${PRICE_LINE}`;
  const url = `${SITE_URL}/for/${trade.slug}`;
  // A page's own openGraph replaces the root one, so the share image is named again.
  const image = { url: "/opengraph-image", width: 1200, height: 630, alt: "QuoteLoop: win more of the jobs you quote" };
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, siteName: "QuoteLoop", title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

const STEPS = [
  { icon: BellRing, text: "Add the quote, and QuoteLoop schedules the follow-ups" },
  { icon: Sparkles, text: "Get a draft that fits the stage of the quote" },
  { icon: Send, text: "Send it from QuoteLoop, or copy it to a text or WhatsApp" },
  { icon: Trophy, text: "Mark the job won or lost, and see your win rate" },
];

export default async function TradePage({ params }: Props) {
  const trade = tradeBySlug((await params).trade);
  if (!trade) notFound();
  const others = TRADES.filter((other) => other.slug !== trade.slug);

  return (
    <main className="min-h-screen pb-24 sm:pb-0">
      <MarketingHeader />

      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 pb-16 pt-10 lg:grid-cols-[1fr_1fr] lg:pt-16">
        <div>
          <p className="text-sm font-semibold text-brand-700">QuoteLoop for {trade.plural}</p>
          <h1 className="mt-3 text-balance text-[2.1rem] font-semibold leading-[1.1] tracking-tight text-stone-950 sm:text-5xl">
            Quote <span className="whitespace-nowrap">follow-up</span> for {trade.plural}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-stone-600">{trade.intro}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="btn-accent px-5 py-2.5 text-base">
              {START_LABEL} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/#tour" className="btn-secondary px-5 py-2.5 text-base">
              See it in action
            </Link>
          </div>
          <p className="mt-4 text-sm text-stone-500">{PRICE_LINE} No credit card to start.</p>
        </div>

        <figure className="card overflow-hidden">
          <figcaption className="border-b border-stone-200 bg-stone-50 px-5 py-3 text-sm">
            <span className="font-semibold text-stone-900">{trade.example.customer}</span>
            <span className="text-stone-500"> · {trade.example.job} · </span>
            <span className="num font-semibold text-stone-900">{trade.example.amount}</span>
            <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-brand-200">
              Follow-up due
            </span>
          </figcaption>
          <div className="p-5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-stone-500">
              <Sparkles className="h-3.5 w-3.5 text-brand-600" aria-hidden /> Example follow-up
            </p>
            <p className="mt-2 leading-relaxed text-stone-800">{trade.example.followUp}</p>
            <p className="mt-4 text-xs text-stone-400">You edit it, then send it or copy it. Nothing goes out on its own.</p>
          </div>
        </figure>
      </section>

      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className={h2}>Why quotes go cold for {trade.plural}</h2>
            <ul className="mt-6 space-y-3">
              {trade.reasons.map((reason) => (
                <li key={reason} className="flex gap-3 text-stone-700">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
                  {reason}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className={h2}>How QuoteLoop helps</h2>
            <ul className="mt-6 space-y-3">
              {STEPS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex gap-3 text-stone-700">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
                  {text}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm leading-relaxed text-stone-600">
              Keep quoting the way you do now. QuoteLoop sits alongside your quoting tool, your spreadsheet or your
              paper pad and makes sure the follow-up happens.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <h2 className={h2}>Your follow-ups for the day, in one place</h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-stone-600">
          Overdue, due today and coming up, with a draft one tap away. On your laptop or your phone.
        </p>
        <Screenshot
          className="mt-8"
          src="/screens/follow-ups.webp"
          alt="The Follow-ups page: one overdue follow-up, two due today and four coming up"
          width={2560}
          height={1600}
        />
      </section>

      <LostQuoteStats />

      <div className="border-y border-stone-200 bg-white">
        <CustomerEmailPreview />
      </div>

      <Pricing />

      <section className="mx-auto max-w-6xl px-6 pt-16 sm:pt-20">
        <h2 className="text-lg font-semibold text-stone-900">QuoteLoop for other trades</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {others.map((other) => (
            <li key={other.slug}>
              <Link
                href={`/for/${other.slug}`}
                className="tap inline-flex items-center rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:border-stone-400 hover:text-stone-950"
              >
                {other.industry}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <FinalCta
        heading="Win more of the jobs you quote"
        body="Add your open quotes, and QuoteLoop tells you who to follow up with and when."
      />

      <SiteFooter />
      <MobileCta />
    </main>
  );
}

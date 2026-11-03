import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PenLine } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import {
  Band,
  CustomerEmailPreview,
  FinalCta,
  h2,
  LostQuoteStats,
  MarketingHeader,
  MobileCta,
  Pricing,
  Screenshot,
  START_LABEL,
  TradeLinks,
  wrap,
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
  "Add the quote, and QuoteLoop schedules the follow-ups",
  "Get a draft that fits the stage of the quote",
  "Send it from QuoteLoop, or copy it to a text or WhatsApp",
  "Mark the job won or lost, and see your win rate",
];

export default async function TradePage({ params }: Props) {
  const trade = tradeBySlug((await params).trade);
  if (!trade) notFound();
  const others = TRADES.filter((other) => other.slug !== trade.slug);

  return (
    <main className="min-h-screen bg-canvas pb-28 sm:pb-0">
      <MarketingHeader />

      <section className={`${wrap} grid grid-cols-1 items-start gap-10 pb-14 pt-10 lg:grid-cols-[1fr_1fr] lg:gap-14 lg:pt-16`}>
        <div className="ql-in">
          <p className="text-[15px] font-semibold text-stone-700">QuoteLoop for {trade.plural}</p>
          <h1 className="mt-3 text-balance text-[37px] font-semibold leading-[1.08] text-stone-900 sm:text-[48px]">
            Quote <span className="whitespace-nowrap">follow-up</span> for {trade.plural}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-stone-700">{trade.intro}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="btn-primary px-6 py-3 text-base">
              {START_LABEL}
            </Link>
            <Link href="/#tour" className="btn-secondary px-6 py-3 text-base">
              See it in action
            </Link>
          </div>
          <p className="mt-4 text-[15px] text-stone-600">{PRICE_LINE} No credit card to start.</p>
        </div>

        {/* An example follow-up, set like a row on the Follow-ups board. */}
        <figure className="ql-fade overflow-hidden rounded-[8px] border border-line bg-white">
          <figcaption className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line px-5 py-3">
            <span className="text-lg font-semibold text-stone-900">{trade.example.customer}</span>
            <span className="text-base text-stone-700">{trade.example.job}</span>
            <span className="num text-[19px] font-semibold text-stone-900">{trade.example.amount}</span>
            <span className="badge bg-brand-200 text-stone-900">Follow-up due</span>
          </figcaption>
          <div className="p-5">
            <p className="flex items-center gap-1.5 text-[15px] font-semibold text-stone-700">
              <PenLine className="h-4 w-4" aria-hidden /> Example follow-up
            </p>
            <p className="mt-2 text-base leading-relaxed text-stone-900">{trade.example.followUp}</p>
            <p className="mt-4 text-[14px] text-stone-600">You edit it, then send it or copy it. Nothing goes out on its own.</p>
          </div>
        </figure>
      </section>

      <Band>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className={h2}>Why quotes go cold for {trade.plural}</h2>
            <ul className="mt-6 divide-y divide-stone-200 border-y border-stone-300">
              {trade.reasons.map((reason) => (
                <li key={reason} className="py-3 text-base leading-relaxed text-stone-800">
                  {reason}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className={h2}>How QuoteLoop helps</h2>
            <ol className="mt-6 divide-y divide-stone-200 border-y border-stone-300">
              {STEPS.map((text, i) => (
                <li key={text} className="flex items-baseline gap-3 py-3 text-base leading-relaxed text-stone-800">
                  <span aria-hidden className="num text-[19px] font-semibold leading-none text-stone-900">
                    {i + 1}
                  </span>
                  {text}
                </li>
              ))}
            </ol>
            <p className="mt-6 text-base leading-relaxed text-stone-700">
              Keep quoting the way you do now. QuoteLoop sits alongside your quoting tool, your spreadsheet or your paper
              pad and makes sure the follow-up happens.
            </p>
          </div>
        </div>
      </Band>

      <Band>
        <h2 className={h2}>Your follow-ups for the day, in one place</h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-stone-700">
          Overdue, due today and coming up, with a draft one tap away. On your laptop or your phone.
        </p>
        <Screenshot
          className="mt-8"
          src="/screens/follow-ups.webp"
          alt="The Follow-ups page: overdue, due today and coming up, each with Write follow-up and Mark followed up buttons"
          width={2560}
          height={1600}
        />
      </Band>

      <LostQuoteStats />

      <CustomerEmailPreview />

      <Pricing />

      <Band>
        <h2 className="text-[22px] font-semibold leading-tight text-stone-900">QuoteLoop for other trades</h2>
        <TradeLinks trades={others} />
      </Band>

      <FinalCta
        heading="Win more of the jobs you quote"
        body="Add your open quotes, and QuoteLoop tells you who to follow up with and when."
      />

      <SiteFooter />
      <MobileCta />
    </main>
  );
}

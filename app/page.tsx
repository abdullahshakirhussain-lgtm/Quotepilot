import Link from "next/link";
import { ArrowRight, BellRing, ShieldCheck, Sparkles } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";

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

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1fr_1.05fr] lg:pt-16">
        <div>
          <p className="eyebrow text-brand-700">Quote follow-up for service businesses</p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight text-stone-950 sm:text-[3.25rem]">
            Every quote you send is money on the table.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-stone-600">
            QuoteLoop tells you who to follow up with today, drafts the message
            for you to review, and shows what you&apos;ve won and lost, so quoted
            jobs don&apos;t quietly go cold.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="btn-accent px-5 py-2.5 text-base">
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="btn-secondary px-5 py-2.5 text-base">
              Log in
            </Link>
          </div>
          <p className="mt-4 text-sm text-stone-500">
            For contractors, cleaners, installers, studios and freelancers. No credit card.
          </p>
        </div>

        {/* Static product preview */}
        <div className="rounded-xl border border-stone-200 bg-white p-2 shadow-xl shadow-stone-900/10">
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
              { who: "Priya Nair", what: "Living room redesign", when: "Tomorrow", dot: "bg-stone-300", tone: "text-stone-500" },
            ].map((r) => (
              <li key={r.who} className="flex items-center gap-3 py-2.5">
                <span className={`h-2 w-2 rounded-full ${r.dot}`} />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-stone-900">{r.who}</span>
                  <span className="text-stone-500"> · {r.what}</span>
                </span>
                <span className={`text-xs font-medium ${r.tone}`}>{r.when}</span>
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
        </div>
      </section>

      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-3">
          {[
            {
              icon: <BellRing className="h-5 w-5" />,
              title: "Log the quote, get reminded",
              body: "Add the customer and amount in one form. Mark it sent and follow-up reminders are scheduled for you.",
            },
            {
              icon: <Sparkles className="h-5 w-5" />,
              title: "A better follow-up in seconds",
              body: "AI drafts a short, specific message from the quote. Review and send it from inside QuoteLoop — or copy it to your own email or phone.",
            },
            {
              icon: <ShieldCheck className="h-5 w-5" />,
              title: "You stay in control",
              body: "Nothing is ever sent automatically. QuoteLoop keeps the text you actually used, and your data stays private.",
            },
          ].map((f) => (
            <div key={f.title}>
              <div className="text-brand-600">{f.icon}</div>
              <h3 className="mt-3 font-semibold text-stone-900">{f.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

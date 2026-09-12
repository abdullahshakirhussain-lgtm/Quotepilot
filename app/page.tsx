import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  ClipboardList,
  LineChart,
  Sparkles,
} from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
            Q
          </span>
          QuotePilot
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="btn-ghost">
            Log in
          </Link>
          <Link href="/signup" className="btn-primary">
            Get started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pb-10 pt-16 text-center">
        <span className="badge bg-brand-50 text-brand-700 ring-1 ring-brand-100">
          For contractors, tradespeople, studios & freelancers
        </span>
        <h1 className="mt-5 text-balance text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Win more jobs from the quotes you already send.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          QuotePilot helps small service businesses track sent quotes, get
          follow-up reminders, and generate AI-written follow-up messages — so
          the deals you&apos;ve already quoted don&apos;t go cold.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/signup" className="btn-primary px-5 py-2.5 text-base">
            Start free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className="btn-secondary px-5 py-2.5 text-base">
            Log in
          </Link>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          No credit card. Set up your workspace in under a minute.
        </p>
      </section>

      {/* Feature grid */}
      <section className="mx-auto grid max-w-5xl gap-5 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-4">
        <Feature
          icon={<ClipboardList className="h-5 w-5" />}
          title="Track every quote"
          body="Log leads and the quotes you send, with amounts, status and notes in one place."
        />
        <Feature
          icon={<BellRing className="h-5 w-5" />}
          title="Never forget a follow-up"
          body="Mark a quote as sent and QuotePilot schedules reminders automatically."
        />
        <Feature
          icon={<Sparkles className="h-5 w-5" />}
          title="AI follow-up messages"
          body="Generate a friendly, ready-to-send follow-up in seconds. You review and send."
        />
        <Feature
          icon={<LineChart className="h-5 w-5" />}
          title="See your pipeline"
          body="Win rate, quoted value and what's due today — on one simple dashboard."
        />
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} QuotePilot. Built for small service businesses.
      </footer>
    </main>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="card p-5">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600">
        {icon}
      </div>
      <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
    </div>
  );
}

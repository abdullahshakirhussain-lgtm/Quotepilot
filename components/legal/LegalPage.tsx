import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";

// Shared building blocks for the public legal pages (/privacy, /terms),
// styled to match the landing page.

export const CONTACT_EMAIL = "hello@quoteloop.site";

const linkClass = "font-medium text-stone-900 underline underline-offset-2 hover:text-brand-700";

export function LegalPage({
  title,
  effectiveDate,
  intro,
  children,
}: {
  title: string;
  effectiveDate: string;
  intro: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-[15px] font-semibold tracking-tight">
          QuoteLoop
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost">
            Log in
          </Link>
          <Link href="/signup" className="btn-primary">
            Start free
          </Link>
        </nav>
      </header>

      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <article className="card px-5 py-8 sm:px-10 sm:py-10">
          <p className="eyebrow text-brand-700">Legal</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">{title}</h1>
          <p className="mt-2 text-sm text-stone-500">Effective date: {effectiveDate}</p>
          <div className="mt-6 space-y-3 leading-relaxed text-stone-700">{intro}</div>
          {children}
        </article>
      </div>

      <SiteFooter />
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="text-lg font-semibold tracking-tight text-stone-900">{title}</h2>
      <div className="mt-2.5 space-y-3 leading-relaxed text-stone-600">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-stone-400">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function ContactEmail() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
      {CONTACT_EMAIL}
    </a>
  );
}

export function InternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={linkClass}>
      {children}
    </Link>
  );
}

export function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className={linkClass} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

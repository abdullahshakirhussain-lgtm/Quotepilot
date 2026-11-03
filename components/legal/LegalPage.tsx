import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { MarketingHeader } from "@/components/marketing/Marketing";

// Shared building blocks for the public legal pages (/privacy, /terms),
// styled to match the landing page.

export const CONTACT_EMAIL = "hello@quoteloop.site";

const linkClass = "font-medium text-info-700 hover:underline";

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
    <main className="min-h-screen bg-canvas">
      <MarketingHeader />

      {/* Long reading text: one comfortable column, no box around it. */}
      <article className="mx-auto w-full max-w-[1240px] px-4 pb-16 pt-8 sm:px-6 sm:pt-12 lg:px-10">
        <div className="card mx-auto max-w-[48rem] px-5 py-8 sm:px-10 sm:py-10">
          <p className="text-[15px] font-semibold text-stone-700">Legal</p>
          <h1 className="page-title mt-2">{title}</h1>
          <p className="num mt-3 text-[15px] text-stone-600">Effective date: {effectiveDate}</p>
          <div className="mt-8 space-y-3 border-t border-line pt-6 text-lg leading-relaxed text-stone-800">{intro}</div>
          {children}
        </div>
      </article>

      <SiteFooter />
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-[22px] font-semibold leading-tight text-stone-900">{title}</h2>
      <div className="mt-2.5 space-y-3 text-base leading-relaxed text-stone-800">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-stone-600">
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

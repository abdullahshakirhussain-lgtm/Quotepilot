import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/marketing";

/** Public footer, shared by the landing page, the trade pages and the legal pages. */
export function SiteFooter() {
  return (
    <footer className="py-8 text-center text-sm text-stone-400">
      <p>© {new Date().getFullYear()} QuoteLoop · Quote follow-up for small service businesses</p>
      <nav aria-label="Site" className="mt-2 flex flex-wrap justify-center gap-x-4">
        <Link href="/#pricing" className="tap inline-flex items-center text-stone-500 hover:text-stone-800">
          Pricing
        </Link>
        <a href={`mailto:${CONTACT_EMAIL}`} className="tap inline-flex items-center text-stone-500 hover:text-stone-800">
          Contact
        </a>
        <Link href="/privacy" className="tap inline-flex items-center text-stone-500 hover:text-stone-800">
          Privacy Policy
        </Link>
        <Link href="/terms" className="tap inline-flex items-center text-stone-500 hover:text-stone-800">
          Terms of Service
        </Link>
      </nav>
    </footer>
  );
}

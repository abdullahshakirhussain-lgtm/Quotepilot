import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/marketing";

const link = "tap inline-flex items-center text-stone-700 underline-offset-4 hover:text-stone-900 hover:underline";

/** Public footer, shared by the landing page, the trade pages and the legal pages. */
export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-10">
      <div className="flex flex-col gap-3 border-t border-line py-8 text-[15px] sm:flex-row sm:items-baseline sm:justify-between">
        <p className="text-stone-600">
          <span className="text-[19px] font-semibold text-stone-900">QuoteLoop</span>{" "}
          © {new Date().getFullYear()}. Quote follow-up for small service businesses.
        </p>
        <nav aria-label="Site" className="flex flex-wrap gap-x-5">
          <Link href="/#pricing" className={link}>
            Pricing
          </Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className={link}>
            Contact
          </a>
          <Link href="/privacy" className={link}>
            Privacy Policy
          </Link>
          <Link href="/terms" className={link}>
            Terms of Service
          </Link>
          <Link href="/refunds" className={link}>
            Refund Policy
          </Link>
        </nav>
      </div>
    </footer>
  );
}

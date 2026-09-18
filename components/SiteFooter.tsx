import Link from "next/link";

/** Public footer, shared by the landing page and the legal pages. */
export function SiteFooter() {
  return (
    <footer className="py-8 text-center text-sm text-stone-400">
      <p>© {new Date().getFullYear()} QuoteLoop · Quote follow-up for small service businesses</p>
      <nav aria-label="Legal" className="mt-2 flex justify-center gap-4">
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

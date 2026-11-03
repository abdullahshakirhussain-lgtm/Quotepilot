import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";

// Any address that doesn't exist: say so plainly and offer a way on.
export default function NotFound() {
  return (
    <AuthShell>
      <div className="ql-in">
        <p className="num font-display text-[22px] font-bold text-stone-600">404</p>
        <h1 className="page-title mt-1">Page not found</h1>
        <p className="mt-3 text-base text-stone-700">
          This page doesn&apos;t exist or has moved. Check the address, or carry on from here.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/dashboard" className="btn-primary">
            Go to dashboard
          </Link>
          <Link href="/" className="btn-secondary">
            QuoteLoop home
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}

import Link from "next/link";
import { Compass } from "lucide-react";

// Any address that doesn't exist: say so plainly and offer a way on.
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4">
      <div className="card max-w-md p-8 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-stone-100 text-stone-500">
          <Compass className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold text-stone-900">Page not found</h1>
        <p className="mt-1 text-sm text-stone-500">
          This page doesn&apos;t exist or has moved. Check the address, or carry on from here.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className="btn-primary">
            Go to dashboard
          </Link>
          <Link href="/" className="btn-secondary">
            QuoteLoop home
          </Link>
        </div>
      </div>
    </main>
  );
}

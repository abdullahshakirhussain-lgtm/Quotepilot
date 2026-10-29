import type { Metadata } from "next";
import Link from "next/link";
import { PaddleCheckout } from "@/components/billing/PaddleCheckout";

export const metadata: Metadata = {
  title: "Checkout — QuoteLoop",
  robots: { index: false, follow: false },
};

/**
 * Paddle's checkout link points here with ?_ptxn=<transaction>. Paddle.js
 * opens the secure checkout on top of this page; card details go straight
 * to Paddle, never through QuoteLoop.
 */
export default async function PayPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { _ptxn } = await searchParams;
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-[15px] font-semibold tracking-tight">QuoteLoop</p>
      {token && typeof _ptxn === "string" && _ptxn ? (
        <PaddleCheckout token={token} />
      ) : (
        <p className="mt-3 max-w-sm text-sm text-stone-600">There's no checkout to open here. Subscribe from Settings → Billing.</p>
      )}
      <Link href="/settings#billing" className="tap mt-6 inline-flex items-center text-sm text-stone-500 hover:text-stone-800">
        Back to Settings
      </Link>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { PaddleCheckout } from "@/components/billing/PaddleCheckout";
import { AuthShell } from "@/components/auth/AuthShell";

export const metadata: Metadata = {
  title: "Checkout | QuoteLoop",
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
    <AuthShell>
      <h1 className="page-title">Checkout</h1>
      {token && typeof _ptxn === "string" && _ptxn ? (
        <PaddleCheckout token={token} />
      ) : (
        <p className="mt-3 text-base text-stone-700">There&apos;s no checkout to open here. Subscribe from Settings, under Billing.</p>
      )}
      <Link
        href="/settings?area=billing"
        className="tap mt-6 inline-flex items-center font-medium text-info-700 hover:underline"
      >
        Back to Settings
      </Link>
    </AuthShell>
  );
}

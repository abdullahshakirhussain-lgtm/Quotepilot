import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { getBillingProvider } from "@/lib/billing-provider";
import { getAccess } from "@/lib/billing-server";
import { billingReturnUrl, PAYMENTS_NOT_SET_UP } from "@/lib/billing-copy";

export const dynamic = "force-dynamic";

/** Opens the provider's page for the card, invoices and canceling. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const provider = getBillingProvider();
  if (!provider) return NextResponse.json({ error: PAYMENTS_NOT_SET_UP }, { status: 503 });

  const customerId = (await getAccess(user.id)).subscription?.provider_customer_id;
  if (!customerId) {
    return NextResponse.json({ error: "There's no payment account to manage yet. Subscribe first." }, { status: 400 });
  }
  try {
    const { url } = await provider.createPortal({ customerId, returnUrl: billingReturnUrl() });
    return NextResponse.json({ url });
  } catch (e) {
    console.error("[billing] portal failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "The billing page couldn't be opened just now. Please try again." }, { status: 500 });
  }
}

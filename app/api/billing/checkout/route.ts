import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { getBillingProvider } from "@/lib/billing-provider";
import { getAccess } from "@/lib/billing-server";
import { billingReturnUrl, PAYMENTS_NOT_SET_UP } from "@/lib/billing-copy";

export const dynamic = "force-dynamic";

/** Starts the provider's hosted checkout for the signed-in user. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const provider = getBillingProvider();
  if (!provider) return NextResponse.json({ error: PAYMENTS_NOT_SET_UP }, { status: 503 });

  const access = await getAccess(user.id);
  // A live subscription (paid, retrying a failed payment, or canceled but paid
  // up) is managed in the portal; a second checkout would bill twice.
  if (access.state === "active" || access.state === "comped" || access.state === "grace" || access.state === "ending") {
    return NextResponse.json({ error: "You already have a subscription. Use Manage billing in Settings instead." }, { status: 409 });
  }
  try {
    const { url } = await provider.createCheckout({ userId: user.id, email: user.email ?? null, returnUrl: billingReturnUrl() });
    return NextResponse.json({ url });
  } catch (e) {
    console.error("[billing] checkout failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Checkout couldn't be started just now. Please try again." }, { status: 502 });
  }
}

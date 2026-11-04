import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { getRequestTimeZone, requestToday } from "@/lib/request-time";
import { getAccess } from "@/lib/billing-server";
import { BillingBanner } from "@/components/billing/BillingBanner";
import { AccessFlag } from "@/components/billing/AccessContext";
import { Sidebar, TabBar, TopBar } from "@/components/Sidebar";
import { QuotePanelHost } from "@/components/quotes/QuotePanel";
import type { Business } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  const supabase = await createClient();
  const today = await requestToday();
  const [{ data: business, error }, attention, access, timeZone] = await Promise.all([
    supabase
      .from("businesses")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle<Business>(),
    // Quotes with a reminder due today or overdue — the sidebar badge. Counted
    // per quote, like the dashboard: several missed reminders are one job.
    fetchAllRows<{ quote_id: string }>((from, to) =>
      supabase
        .from("follow_ups")
        .select("quote_id")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .lte("due_date", today)
        .order("id")
        .range(from, to)
    ),
    getAccess(user.id),
    getRequestTimeZone(),
  ]);

  // A failed query must not look like "no workspace" — that would send an
  // existing user back through onboarding.
  if (error) throw new Error(`Could not load workspace: ${error.message}`);

  // No workspace yet -> send them through onboarding first.
  if (!business) redirect("/onboarding");

  // A trial with more than three days left isn't news: a quiet line in the
  // navigation instead of a banner on every page.
  const quietTrial = access.state === "trial" && (access.daysLeft ?? 0) > 3;

  const attentionCount = new Set(attention.map((f) => f.quote_id)).size;

  return (
    <div className="flex min-h-screen flex-col">
      <AccessFlag canWrite={access.canWrite} />
      <TopBar
        businessName={business.business_name}
        trialNote={quietTrial ? `Free trial: ${access.daysLeft} days left` : null}
      />
      {/* Menu down the left from laptop width; a tab bar along the bottom below it. */}
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 gap-5 px-4 py-5 sm:px-6 lg:px-5">
        <Sidebar attentionCount={attentionCount} />
        {/* On phones the tab bar is fixed along the bottom: keep the page clear of it. */}
        <main className="min-w-0 flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
          <BillingBanner
            state={access.state}
            canWrite={access.canWrite}
            endsAt={access.endsAt}
            daysLeft={access.daysLeft}
            timeZone={timeZone}
          />
          {children}
        </main>
      </div>
      <TabBar attentionCount={attentionCount} />
      {/* Any quote opens over the page you're on (?view=<quote id>). */}
      <Suspense fallback={null}>
        <QuotePanelHost today={today} />
      </Suspense>
    </div>
  );
}

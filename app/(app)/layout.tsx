import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { requestToday } from "@/lib/request-time";
import { Sidebar } from "@/components/Sidebar";
import type { Business } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  const supabase = await createClient();
  const [{ data: business, error }, attention] = await Promise.all([
    supabase
      .from("businesses")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle<Business>(),
    // Quotes with a reminder due today or overdue — the sidebar badge. Counted
    // per quote, like the dashboard: several missed reminders are one job.
    requestToday().then((today) =>
      fetchAllRows<{ quote_id: string }>((from, to) =>
        supabase
          .from("follow_ups")
          .select("quote_id")
          .eq("user_id", user.id)
          .eq("status", "pending")
          .lte("due_date", today)
          .order("id")
          .range(from, to)
      )
    ),
  ]);

  // A failed query must not look like "no workspace" — that would send an
  // existing user back through onboarding.
  if (error) throw new Error(`Could not load workspace: ${error.message}`);

  // No workspace yet -> send them through onboarding first.
  if (!business) redirect("/onboarding");

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar
        businessName={business.business_name}
        attentionCount={new Set(attention.map((f) => f.quote_id)).size}
      />
      {/* On phones the tab bar is fixed along the bottom: keep the page clear of it. */}
      <main className="min-w-0 flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

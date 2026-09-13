import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
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
  const { data: business, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<Business>();

  // A failed query must not look like "no workspace" — that would send an
  // existing user back through onboarding.
  if (error) throw new Error(`Could not load workspace: ${error.message}`);

  // No workspace yet -> send them through onboarding first.
  if (!business) redirect("/onboarding");

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
      <Sidebar businessName={business.business_name} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}

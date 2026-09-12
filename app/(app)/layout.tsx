import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import type { Business } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<Business>();

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

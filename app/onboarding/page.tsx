import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { BusinessForm } from "@/components/BusinessForm";
import { createBusiness } from "@/app/(app)/settings/actions";
import type { Business } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle<Business>();

  if (business) redirect("/dashboard");

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-2 text-lg font-bold text-slate-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
            Q
          </span>
          QuotePilot
        </div>
        <div className="card p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">
            Set up your workspace
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Tell us about your business. You can change any of this later in
            Settings.
          </p>
          <div className="mt-6">
            <BusinessForm action={createBusiness} submitLabel="Create workspace" />
          </div>
        </div>
      </div>
    </main>
  );
}

import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import { BusinessForm } from "@/components/BusinessForm";
import { createBusiness } from "@/app/(app)/settings/actions";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();

  const supabase = await createClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(`Could not load workspace: ${error.message}`);
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

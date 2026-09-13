import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import { BusinessForm } from "@/components/BusinessForm";
import { BrandMark } from "@/components/Sidebar";
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
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
          <BrandMark />
          QuotePilot
        </div>
        <div className="card p-6 sm:p-8">
          <p className="eyebrow text-brand-700">Step 1 of 1</p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-stone-900">
            Tell us about your business
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Your name and business sign the follow-ups QuotePilot drafts. You can
            change any of this later in Settings.
          </p>
          <div className="mt-6">
            <BusinessForm
              action={createBusiness}
              submitLabel="Create workspace"
              suggested={{
                // Google sign-in provides a name; email/password users type theirs.
                owner_name:
                  (user.user_metadata?.full_name as string | undefined) ??
                  (user.user_metadata?.name as string | undefined) ??
                  "",
                email: user.email ?? "",
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

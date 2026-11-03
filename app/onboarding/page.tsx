import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import { BusinessForm } from "@/components/BusinessForm";
import { createBusiness } from "@/app/(app)/settings/actions";
import { AuthShell } from "@/components/auth/AuthShell";

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
    <AuthShell wide>
      <div className="ql-in">
        <p className="text-[15px] font-semibold text-stone-700">Welcome to QuoteLoop</p>
        <h1 className="page-title mt-2">Tell us about your business</h1>
        <p className="mt-3 max-w-prose text-base text-stone-700">
          Your name and business sign the follow-ups QuoteLoop drafts. You can change any of this later in Settings.
        </p>
        <div className="mt-6 border-t border-[#ECEEF1] pt-6">
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
    </AuthShell>
  );
}

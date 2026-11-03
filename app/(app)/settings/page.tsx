import Link from "next/link";
import { Download, LogOut } from "lucide-react";
import { createClient, requireUser } from "@/lib/supabase/server";
import { BusinessForm } from "@/components/BusinessForm";
import { DataControls } from "@/components/DataControls";
import { updateBusiness } from "./actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsSection } from "@/components/ui/SettingsSection";
import { BillingSection } from "@/components/billing/BillingSection";
import { getAccess } from "@/lib/billing-server";
import { getBillingProvider } from "@/lib/billing-provider";
import { getRequestTimeZone } from "@/lib/request-time";
import type { Business } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ export?: string; focus?: string; billing?: string }>;
}) {
  const { export: exportStatus, focus, billing } = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<Business>();

  if (error) throw new Error(`Could not load settings: ${error.message}`);
  const [access, timeZone] = await Promise.all([getAccess(user.id), getRequestTimeZone()]);

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your business details, reminder schedule and data." />

      {/* Most used first; the one destructive control last, in its own red section. */}
      <SettingsSection
        title="Business profile"
        description="Used to sign AI-drafted follow-ups. The reminder schedule applies to quotes you send or track from now on."
      >
        {/* ?focus=business-email: sent here from "Add business email". */}
        <BusinessForm
          action={updateBusiness}
          initial={business}
          submitLabel="Save changes"
          highlightEmail={focus === "business-email"}
        />
      </SettingsSection>

      <BillingSection
        state={access.state}
        endsAt={access.endsAt}
        daysLeft={access.daysLeft}
        timeZone={timeZone}
        providerReady={getBillingProvider() !== null}
        hasPaymentAccount={Boolean(access.subscription?.provider_customer_id)}
        justReturned={billing === "done"}
      />

      <SettingsSection title="Export" description="Download your records as CSV. Opens in Excel or Google Sheets.">
        {exportStatus === "failed" && (
          <div role="alert" className="msg-error mb-4">
            That export couldn&apos;t be created just now, so nothing was downloaded. Try again in a moment.
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <a href="/api/export/quotes" className="btn-secondary">
            <Download className="h-4 w-4" /> Quotes
          </a>
          <a href="/api/export/follow-ups" className="btn-secondary">
            <Download className="h-4 w-4" /> Follow-ups
          </a>
          <a href="/api/export/leads" className="btn-secondary">
            <Download className="h-4 w-4" /> Customers
          </a>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Account"
        description={
          <span className="[overflow-wrap:anywhere]">
            Signed in as <span className="font-semibold text-stone-900">{user.email}</span>.
          </span>
        }
      >
        <form action="/auth/signout" method="post">
          <button className="btn-secondary">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </form>
      </SettingsSection>

      <DataControls />

      <p className="flex flex-wrap gap-x-5 px-1 pt-1 text-[14px] text-stone-500">
        <Link href="/privacy" className="tap inline-flex items-center underline-offset-4 hover:text-stone-900 hover:underline">
          Privacy Policy
        </Link>
        <Link href="/terms" className="tap inline-flex items-center underline-offset-4 hover:text-stone-900 hover:underline">
          Terms of Service
        </Link>
        <Link href="/refunds" className="tap inline-flex items-center underline-offset-4 hover:text-stone-900 hover:underline">
          Refund Policy
        </Link>
      </p>
    </div>
  );
}

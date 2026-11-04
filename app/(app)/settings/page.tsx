import Link from "next/link";
import { Download, LogOut } from "lucide-react";
import { createClient, requireUser } from "@/lib/supabase/server";
import { recordVisit } from "@/lib/visits-server";
import { BusinessForm } from "@/components/BusinessForm";
import { DataControls } from "@/components/DataControls";
import { updateBusiness } from "./actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsSection } from "@/components/ui/SettingsSection";
import { SettingsAreas } from "@/components/ui/SettingsAreas";
import { BillingSection } from "@/components/billing/BillingSection";
import { getAccess } from "@/lib/billing-server";
import { getBillingProvider } from "@/lib/billing-provider";
import { getRequestTimeZone, requestToday } from "@/lib/request-time";
import { loadTemplates } from "@/lib/templates-server";
import { settingsArea } from "@/lib/settings-areas";
import { TemplatesSection } from "@/components/templates/TemplatesSection";
import type { Business } from "@/lib/types";

export const dynamic = "force-dynamic";

/** One area of Settings at a time (?area=business|messages|billing|data). */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; export?: string; focus?: string; billing?: string }>;
}) {
  const params = await searchParams;
  const { export: exportStatus, focus, billing } = params;
  const area = settingsArea(params);
  const user = await requireUser();
  // This visit, for QuoteLoop's own analytics: runs alongside the queries below.
  const visit = recordVisit(`/settings/${area}`);
  const supabase = await createClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<Business>();

  if (error) throw new Error(`Could not load settings: ${error.message}`);

  await visit;
  return (
    <div>
      <PageHeader title="Settings" />
      <SettingsAreas current={area} />

      {area === "business" && (
        <>
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
        </>
      )}

      {area === "messages" && (
        <TemplatesSection
          initialRows={await loadTemplates(user.id)}
          business={{
            name: business?.business_name ?? "",
            ownerName: business?.owner_name ?? null,
            signOff: business?.sign_off ?? null,
            signature: business?.signature ?? null,
          }}
          quoteTemplate={business?.quote_template ?? null}
          today={await requestToday()}
        />
      )}

      {area === "billing" && <Billing userId={user.id} justReturned={billing === "done"} />}

      {area === "data" && (
        <>
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

          {/* Sample data, then the one destructive control last, in its own red section. */}
          <DataControls />
        </>
      )}

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

async function Billing({ userId, justReturned }: { userId: string; justReturned: boolean }) {
  const [access, timeZone] = await Promise.all([getAccess(userId), getRequestTimeZone()]);
  return (
    <BillingSection
      state={access.state}
      endsAt={access.endsAt}
      daysLeft={access.daysLeft}
      timeZone={timeZone}
      providerReady={getBillingProvider() !== null}
      hasPaymentAccount={Boolean(access.subscription?.provider_customer_id)}
      justReturned={justReturned}
    />
  );
}

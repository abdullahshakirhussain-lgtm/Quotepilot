import Link from "next/link";
import { Download } from "lucide-react";
import { createClient, requireUser } from "@/lib/supabase/server";
import { BusinessForm } from "@/components/BusinessForm";
import { DataControls } from "@/components/DataControls";
import { PageHeader } from "@/components/ui/PageHeader";
import { updateBusiness } from "./actions";
import type { Business } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<Business>();

  if (error) throw new Error(`Could not load settings: ${error.message}`);

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your business details, reminder schedule and data." />

      <div className="space-y-6">
        <section className="card p-5">
          <h2 className="text-[15px] font-semibold text-stone-900">Business profile</h2>
          <p className="mb-5 mt-0.5 text-sm text-stone-500">
            Used to sign AI-drafted follow-ups. The reminder schedule applies to
            quotes you send or track from now on.
          </p>
          <BusinessForm action={updateBusiness} initial={business} submitLabel="Save changes" />
        </section>

        <section className="card p-5">
          <h2 className="text-[15px] font-semibold text-stone-900">Export</h2>
          <p className="mb-4 mt-0.5 text-sm text-stone-500">
            Download your records as CSV. Opens in Excel or Google Sheets.
          </p>
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
        </section>

        <section className="card p-5">
          <h2 className="text-[15px] font-semibold text-stone-900">Demo data</h2>
          <p className="mb-4 mt-0.5 text-sm text-stone-500">
            Load sample quotes into an empty workspace to explore, or clear your
            customers, quotes and follow-ups to start fresh. Your business profile is kept.
          </p>
          <DataControls />
        </section>

        <p className="text-center text-xs text-stone-500">
          <Link href="/privacy" className="hover:text-stone-800">
            Privacy Policy
          </Link>
          {" · "}
          <Link href="/terms" className="hover:text-stone-800">
            Terms of Service
          </Link>
        </p>
      </div>
    </div>
  );
}

import { Download } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { BusinessForm } from "@/components/BusinessForm";
import { DataControls } from "@/components/DataControls";
import { updateBusiness } from "./actions";
import type { Business } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", user!.id)
    .maybeSingle<Business>();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your business profile, follow-up defaults and data.
        </p>
      </header>

      <section className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900">Business profile</h2>
        <p className="mb-5 text-sm text-slate-500">
          Used across the app and in AI-generated follow-up messages.
        </p>
        <BusinessForm
          action={updateBusiness}
          initial={business}
          submitLabel="Save changes"
        />
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900">Export data</h2>
        <p className="mb-4 text-sm text-slate-500">
          Download your records as CSV files (opens in Excel / Google Sheets).
        </p>
        <div className="flex flex-wrap gap-3">
          <a href="/api/export/leads" className="btn-secondary">
            <Download className="h-4 w-4" /> Leads CSV
          </a>
          <a href="/api/export/quotes" className="btn-secondary">
            <Download className="h-4 w-4" /> Quotes CSV
          </a>
          <a href="/api/export/follow-ups" className="btn-secondary">
            <Download className="h-4 w-4" /> Follow-ups CSV
          </a>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900">Demo data</h2>
        <p className="mb-4 text-sm text-slate-500">
          Load a set of realistic sample records to explore the app, or wipe
          everything to start clean.
        </p>
        <DataControls />
      </section>
    </div>
  );
}

import { createClient, requireUser } from "@/lib/supabase/server";
import {
  PipelineClient,
  type PipelineLead,
} from "@/components/pipeline/PipelineClient";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { KanbanSquare } from "lucide-react";
import Link from "next/link";
import type { LeadStatus } from "@/lib/constants";
import type { Business } from "@/lib/types";
import { sumByCurrency } from "@/lib/metrics";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

export const dynamic = "force-dynamic";

type LeadWithQuotes = {
  id: string;
  customer_name: string;
  company_name: string | null;
  status: LeadStatus;
  quotes: { amount: number; currency: string | null }[] | null;
};

export default async function PipelinePage() {
  const user = await requireUser();
  const supabase = await createClient();

  // Every customer, not just the API's first page.
  const [leads, businessRes] = await Promise.all([
    fetchAllRows<LeadWithQuotes>((from, to) =>
      supabase
        .from("leads")
        .select("id, customer_name, company_name, status, quotes(amount, currency)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to)
    ),
    supabase
      .from("businesses")
      .select("currency")
      .eq("user_id", user.id)
      .maybeSingle<Pick<Business, "currency">>(),
  ]);
  if (businessRes.error) throw new Error(`Could not load pipeline: ${businessRes.error.message}`);

  const currency = businessRes.data?.currency ?? "USD";

  const rows: PipelineLead[] = leads.map((l) => ({
    id: l.id,
    customer_name: l.customer_name,
    company_name: l.company_name ?? null,
    status: l.status,
    // Per currency: a customer's quotes in different currencies aren't added up.
    quoteTotals: sumByCurrency(l.quotes ?? [], currency),
  }));

  if (rows.length === 0) {
    return (
      <div>
        <PageHeader title="Pipeline" subtitle="Every customer by stage." />
        <EmptyState
          icon={<KanbanSquare className="h-5 w-5" />}
          title="Your pipeline is empty"
          description="Customers appear here as you add quotes, grouped by how far along they are."
          action={
            <Link href="/quotes?new=1" className="btn-primary">
              New quote
            </Link>
          }
        />
      </div>
    );
  }

  return <PipelineClient leads={rows} currency={currency} />;
}

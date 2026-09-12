import { createClient, getCurrentUser } from "@/lib/supabase/server";
import {
  PipelineClient,
  type PipelineLead,
} from "@/components/pipeline/PipelineClient";
import { EmptyState } from "@/components/ui/EmptyState";
import { KanbanSquare } from "lucide-react";
import Link from "next/link";
import type { LeadStatus } from "@/lib/constants";
import type { Business } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [{ data: leads }, { data: business }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, customer_name, company_name, status, quotes(amount)")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("businesses")
      .select("currency")
      .eq("user_id", user!.id)
      .maybeSingle<Pick<Business, "currency">>(),
  ]);

  const currency = business?.currency ?? "USD";

  const rows: PipelineLead[] = (leads ?? []).map((l: Record<string, unknown>) => {
    const quotes = (l.quotes as { amount: number }[] | null) ?? [];
    return {
      id: l.id as string,
      customer_name: l.customer_name as string,
      company_name: (l.company_name as string) ?? null,
      status: l.status as LeadStatus,
      quoteTotal: quotes.reduce((s, q) => s + Number(q.amount), 0),
      currency,
    };
  });

  if (rows.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-slate-900">Pipeline</h1>
        <EmptyState
          icon={<KanbanSquare className="h-6 w-6" />}
          title="Your pipeline is empty"
          description="Add leads to see them organised by stage here."
          action={
            <Link href="/leads" className="btn-primary">
              Add a lead
            </Link>
          }
        />
      </div>
    );
  }

  return <PipelineClient leads={rows} />;
}

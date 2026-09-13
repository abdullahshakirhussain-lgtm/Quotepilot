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

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [leadsRes, businessRes] = await Promise.all([
    supabase
      .from("leads")
      .select("id, customer_name, company_name, status, quotes(amount)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("businesses")
      .select("currency")
      .eq("user_id", user.id)
      .maybeSingle<Pick<Business, "currency">>(),
  ]);

  const failed = [leadsRes, businessRes].find((r) => r.error);
  if (failed?.error) throw new Error(`Could not load pipeline: ${failed.error.message}`);

  const currency = businessRes.data?.currency ?? "USD";

  const rows: PipelineLead[] = (leadsRes.data ?? []).map((l: Record<string, unknown>) => {
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

  return <PipelineClient leads={rows} />;
}

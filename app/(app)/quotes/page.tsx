import { createClient, requireUser } from "@/lib/supabase/server";
import { QuotesClient } from "@/components/quotes/QuotesClient";
import { requestToday } from "@/lib/request-time";
import type { Business, Lead, QuoteWithLead } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const { lead: preselectLeadId } = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();

  const [quotesRes, leadsRes, businessRes] = await Promise.all([
    supabase
      .from("quotes")
      .select("*, lead:leads(id, customer_name, company_name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("leads")
      .select("id, customer_name, company_name")
      .eq("user_id", user.id)
      .order("customer_name", { ascending: true }),
    supabase
      .from("businesses")
      .select("currency")
      .eq("user_id", user.id)
      .maybeSingle<Pick<Business, "currency">>(),
  ]);

  const failed = [quotesRes, leadsRes, businessRes].find((r) => r.error);
  if (failed?.error) throw new Error(`Could not load quotes: ${failed.error.message}`);

  // Normalise the embedded lead (Supabase may return it as an array).
  const quotes: QuoteWithLead[] = (quotesRes.data ?? []).map((q) => ({
    ...(q as QuoteWithLead),
    lead: Array.isArray(q.lead) ? (q.lead[0] ?? null) : (q.lead ?? null),
  }));

  return (
    <QuotesClient
      quotes={quotes}
      leads={(leadsRes.data as Pick<Lead, "id" | "customer_name" | "company_name">[]) ?? []}
      defaultCurrency={businessRes.data?.currency ?? "USD"}
      initialNewLeadId={preselectLeadId}
      today={await requestToday()}
    />
  );
}

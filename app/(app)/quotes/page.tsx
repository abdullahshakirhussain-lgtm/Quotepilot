import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { QuotesClient } from "@/components/quotes/QuotesClient";
import type { Business, Lead, QuoteWithLead } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const { lead: preselectLeadId } = await searchParams;
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [{ data: quotesData }, { data: leadsData }, { data: business }] =
    await Promise.all([
      supabase
        .from("quotes")
        .select(
          "*, lead:leads(id, customer_name, company_name)"
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("leads")
        .select("id, customer_name, company_name")
        .eq("user_id", user!.id)
        .order("customer_name", { ascending: true }),
      supabase
        .from("businesses")
        .select("currency")
        .eq("user_id", user!.id)
        .maybeSingle<Pick<Business, "currency">>(),
    ]);

  // Normalise the embedded lead (Supabase may return it as an array).
  const quotes: QuoteWithLead[] = (quotesData ?? []).map((q) => ({
    ...(q as QuoteWithLead),
    lead: Array.isArray(q.lead) ? (q.lead[0] ?? null) : (q.lead ?? null),
  }));

  return (
    <QuotesClient
      quotes={quotes}
      leads={(leadsData as Pick<Lead, "id" | "customer_name" | "company_name">[]) ?? []}
      defaultCurrency={business?.currency ?? "USD"}
      initialNewLeadId={preselectLeadId}
    />
  );
}

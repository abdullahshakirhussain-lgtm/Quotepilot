import { createClient, requireUser } from "@/lib/supabase/server";
import { QuotesClient } from "@/components/quotes/QuotesClient";
import { requestToday } from "@/lib/request-time";
import { emailConfig } from "@/lib/email";
import type { Business, QuoteWithLead } from "@/lib/types";
import type { QuoteCustomer } from "@/components/quotes/NewQuoteModal";

export const dynamic = "force-dynamic";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; new?: string }>;
}) {
  const { lead: preselectLeadId, new: openNew } = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();

  const [quotesRes, leadsRes, businessRes] = await Promise.all([
    supabase
      .from("quotes")
      .select("*, lead:leads(id, customer_name, company_name, email)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("leads")
      .select("id, customer_name, company_name, email")
      .eq("user_id", user.id)
      .order("customer_name", { ascending: true }),
    supabase
      .from("businesses")
      .select("currency, business_name, owner_name, email")
      .eq("user_id", user.id)
      .maybeSingle<Pick<Business, "currency" | "business_name" | "owner_name" | "email">>(),
  ]);

  const failed = [quotesRes, leadsRes, businessRes].find((r) => r.error);
  if (failed?.error) throw new Error(`Could not load quotes: ${failed.error.message}`);

  // Normalise the embedded customer (Supabase may return it as an array).
  const quotes: QuoteWithLead[] = (quotesRes.data ?? []).map((q) => ({
    ...(q as QuoteWithLead),
    lead: Array.isArray(q.lead) ? (q.lead[0] ?? null) : (q.lead ?? null),
  }));

  // A draft whose quote email already went out (or may have) must not offer to
  // send it again. The server refuses anyway; this keeps the card honest.
  const earlierQuoteEmails: Record<string, "sent" | "pending"> = {};
  const draftIds = quotes.filter((q) => q.status === "draft").map((q) => q.id);
  if (draftIds.length) {
    const { data: attempts, error: attemptsError } = await supabase
      .from("email_logs")
      .select("quote_id, status")
      .eq("user_id", user.id)
      .in("quote_id", draftIds)
      .in("status", ["pending", "sent"]);
    if (attemptsError) {
      console.error("[quotes] earlier quote emails unavailable:", attemptsError.message);
    }
    for (const a of attempts ?? []) {
      if (a.status === "sent" || !earlierQuoteEmails[a.quote_id]) {
        earlierQuoteEmails[a.quote_id] = a.status as "sent" | "pending";
      }
    }
  }

  return (
    <QuotesClient
      quotes={quotes}
      customers={(leadsRes.data as QuoteCustomer[]) ?? []}
      defaultCurrency={businessRes.data?.currency ?? "USD"}
      business={{
        name: businessRes.data?.business_name ?? "",
        ownerName: businessRes.data?.owner_name ?? null,
        email: businessRes.data?.email ?? null,
      }}
      emailEnabled={emailConfig() !== null}
      earlierQuoteEmails={earlierQuoteEmails}
      initialNewLeadId={preselectLeadId}
      openNew={openNew === "1"}
      today={await requestToday()}
    />
  );
}

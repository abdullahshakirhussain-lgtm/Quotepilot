import { createClient, requireUser } from "@/lib/supabase/server";
import { QuotesClient } from "@/components/quotes/QuotesClient";
import { requestToday } from "@/lib/request-time";
import { emailConfig } from "@/lib/email";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
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

  // Every quote and customer, not just the API's first page.
  const [rawQuotes, customers, businessRes] = await Promise.all([
    fetchAllRows<QuoteWithLead>((from, to) =>
      supabase
        .from("quotes")
        .select("*, lead:leads(id, customer_name, company_name, email)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to)
    ),
    fetchAllRows<QuoteCustomer>((from, to) =>
      supabase
        .from("leads")
        .select("id, customer_name, company_name, email")
        .eq("user_id", user.id)
        .order("customer_name", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    ),
    supabase
      .from("businesses")
      .select("currency, business_name, owner_name, email")
      .eq("user_id", user.id)
      .maybeSingle<Pick<Business, "currency" | "business_name" | "owner_name" | "email">>(),
  ]);
  if (businessRes.error) throw new Error(`Could not load quotes: ${businessRes.error.message}`);

  // Normalise the embedded customer (Supabase may return it as an array).
  const quotes: QuoteWithLead[] = rawQuotes.map((q) => ({
    ...q,
    lead: Array.isArray(q.lead) ? (q.lead[0] ?? null) : (q.lead ?? null),
  }));

  // A draft whose quote email already went out (or may have) must not offer to
  // send it again. The server refuses anyway; this keeps the card honest.
  // Quote emails are the logs without a reminder; matching them to drafts here
  // (rather than listing every draft id in the request) keeps the URL short.
  const earlierQuoteEmails: Record<string, "sent" | "pending"> = {};
  const draftIds = new Set(quotes.filter((q) => q.status === "draft").map((q) => q.id));
  if (draftIds.size) {
    try {
      const attempts = await fetchAllRows<{ quote_id: string; status: string }>((from, to) =>
        supabase
          .from("email_logs")
          .select("quote_id, status")
          .eq("user_id", user.id)
          .is("follow_up_id", null)
          .not("quote_id", "is", null)
          .in("status", ["pending", "sent"])
          .order("id")
          .range(from, to)
      );
      for (const a of attempts) {
        if (!draftIds.has(a.quote_id)) continue;
        if (a.status === "sent" || !earlierQuoteEmails[a.quote_id]) {
          earlierQuoteEmails[a.quote_id] = a.status as "sent" | "pending";
        }
      }
    } catch (e) {
      console.error("[quotes] earlier quote emails unavailable:", e instanceof Error ? e.message : e);
    }
  }

  return (
    <QuotesClient
      quotes={quotes}
      customers={customers}
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

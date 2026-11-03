import { createClient, requireUser } from "@/lib/supabase/server";
import { LeadsClient } from "@/components/leads/LeadsClient";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeadsPage(props: { searchParams?: Promise<{ new?: string }> }) {
  // "Add customer" on the dashboard links here with ?new=1 to open the form.
  // (Test harnesses call the page with no props at all.)
  const startNew = (await props?.searchParams)?.new;
  const user = await requireUser();
  const supabase = await createClient();
  // Every customer, not just the API's first page. A failed query throws, so
  // it shows the error screen rather than the "No customers yet" state.
  const leads = await fetchAllRows<Lead>((from, to) =>
    supabase
      .from("leads")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to)
  );

  return <LeadsClient leads={leads} startNew={startNew === "1"} />;
}

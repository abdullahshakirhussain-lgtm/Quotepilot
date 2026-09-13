import { createClient, requireUser } from "@/lib/supabase/server";
import { LeadsClient } from "@/components/leads/LeadsClient";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // A failed query must show the error boundary, not the "No leads yet" state.
  if (error) throw new Error(`Could not load leads: ${error.message}`);

  return <LeadsClient leads={(data as Lead[]) ?? []} />;
}

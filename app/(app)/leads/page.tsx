import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { LeadsClient } from "@/components/leads/LeadsClient";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return <LeadsClient leads={(data as Lead[]) ?? []} />;
}

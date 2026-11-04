// What every admin page starts from: the gate, then the data, read once per
// request.
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "./access";
import { loadAdminData, type AdminData } from "./data";
import { summarizeAccounts, type AccountSummary } from "./metrics";

export type AdminView =
  | { ok: true; data: AdminData; accounts: AccountSummary[]; now: Date }
  | { ok: false; reason: string };

export const adminView = cache(async (): Promise<AdminView> => {
  await requireAdmin();
  const db = createAdminClient();
  if (!db) return { ok: false, reason: "SUPABASE_SERVICE_ROLE_KEY isn't set on the server, so the admin can't read anything." };
  const now = new Date();
  const data = await loadAdminData(db, now);
  return { ok: true, data, accounts: summarizeAccounts(data, now), now };
});

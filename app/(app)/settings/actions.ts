"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import { CURRENCIES } from "@/lib/constants";
import { optionalString, requireString, todayISO } from "@/lib/utils";
import { buildDemoSeed } from "@/lib/demo-seed";
import { sanitizeFollowUpDays } from "@/lib/quote-state";

export interface ActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

function revalidateAll() {
  for (const path of ["/dashboard", "/leads", "/quotes", "/follow-ups", "/pipeline", "/settings"]) {
    revalidatePath(path);
  }
}

function readBusinessForm(formData: FormData) {
  const currency = requireString(formData.get("currency"), "Currency").toUpperCase();
  if (!(CURRENCIES as readonly string[]).includes(currency)) {
    throw new Error("Unsupported currency.");
  }
  return {
    business_name: requireString(formData.get("business_name"), "Business name"),
    industry: requireString(formData.get("industry"), "Industry"),
    currency,
    owner_name: requireString(formData.get("owner_name"), "Your name"),
    phone: optionalString(formData.get("phone")),
    email: optionalString(formData.get("email")),
    default_follow_up_days: sanitizeFollowUpDays(formData.getAll("default_follow_up_days")),
  };
}

export async function createBusiness(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();

  let payload;
  try {
    payload = { ...readBusinessForm(formData), user_id: user.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("businesses").insert(payload);
  // 23505 = unique violation: the workspace already exists (e.g. a double
  // submit or a second tab). That's success, not an error.
  if (error && error.code !== "23505") return { error: error.message };

  redirect("/dashboard");
}

export async function updateBusiness(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();

  let payload;
  try {
    payload = readBusinessForm(formData);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update(payload)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true, message: "Settings saved." };
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

export async function seedDemoData(): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();
  const uid = user.id;

  // Refuse to stack a second copy on top of existing records.
  const { count, error: countError } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid);
  if (countError) return { error: countError.message };
  if ((count ?? 0) > 0) {
    return {
      error:
        "Demo data can only be loaded into an empty workspace. Use “Delete all data” first if you want a fresh demo set.",
    };
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("currency, owner_name, business_name")
    .eq("user_id", uid)
    .maybeSingle();

  const seed = buildDemoSeed(
    todayISO(),
    business?.currency ?? "USD",
    business?.owner_name || business?.business_name || "The team"
  );

  try {
    const { data: leads, error: leadError } = await supabase
      .from("leads")
      .insert(seed.leads.map((l) => ({ ...l, user_id: uid })))
      .select("id, customer_name");
    if (leadError || !leads) throw new Error(leadError?.message ?? "no leads returned");
    const leadId = (name: string) => {
      const id = leads.find((l) => l.customer_name === name)?.id;
      if (!id) throw new Error(`missing lead ${name}`);
      return id;
    };

    const { data: quotes, error: quoteError } = await supabase
      .from("quotes")
      .insert(seed.quotes.map(({ lead, ...q }) => ({ ...q, user_id: uid, lead_id: leadId(lead) })))
      .select("id, title");
    if (quoteError || !quotes) throw new Error(quoteError?.message ?? "no quotes returned");
    const quoteId = (title: string) => {
      const id = quotes.find((q) => q.title === title)?.id;
      if (!id) throw new Error(`missing quote ${title}`);
      return id;
    };

    const { error: fuError } = await supabase.from("follow_ups").insert(
      seed.followUps.map(({ quoteTitle, lead, ...f }) => ({
        ...f,
        user_id: uid,
        quote_id: quoteId(quoteTitle),
        lead_id: leadId(lead),
      }))
    );
    if (fuError) throw new Error(fuError.message);

    const { quoteTitle, lead, ...message } = seed.message;
    const { error: msgError } = await supabase.from("messages").insert({
      ...message,
      user_id: uid,
      quote_id: quoteId(quoteTitle),
      lead_id: leadId(lead),
    });
    if (msgError) throw new Error(msgError.message);
  } catch (e) {
    revalidateAll();
    return {
      error: `Demo data only partly loaded (${e instanceof Error ? e.message : "unknown error"}). Use “Delete all data” and try again.`,
    };
  }

  revalidateAll();
  return { ok: true, message: "Demo data loaded. Head to the Dashboard to explore it." };
}

/** Deletes all of the current user's leads/quotes/follow-ups/messages (keeps the workspace). */
export async function clearAllData(): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();

  // Children first, so a failure part-way never leaves orphaned references.
  for (const table of ["messages", "follow_ups", "quotes", "leads"] as const) {
    const { error } = await supabase.from(table).delete().eq("user_id", user.id);
    if (error) {
      revalidateAll();
      return { error: `Could not delete ${table.replace("_", "-")}: ${error.message}` };
    }
  }

  revalidateAll();
  return { ok: true, message: "All leads, quotes, follow-ups and messages were deleted." };
}

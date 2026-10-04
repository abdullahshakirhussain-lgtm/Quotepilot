"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import { CURRENCIES, FOLLOW_UP_DAY_OPTIONS } from "@/lib/constants";
import { optionalString } from "@/lib/utils";
import { cleanPasted, isSampleAddress, isValidEmail } from "@/lib/email-address";
import { requestToday } from "@/lib/request-time";
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

/** A problem with what the user typed: its message is safe to show as-is. */
class InputError extends Error {}

/** Longest business name, owner name and industry kept. */
const NAME_LIMIT = 120;
const PHONE_LIMIT = 40;

function required(formData: FormData, field: string, missing: string, label: string): string {
  const value = optionalString(formData.get(field));
  if (!value) throw new InputError(missing);
  if (value.length > NAME_LIMIT) {
    throw new InputError(`${label} is too long. Keep it under ${NAME_LIMIT} characters.`);
  }
  return value;
}

function readBusinessForm(formData: FormData) {
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  if (!(CURRENCIES as readonly string[]).includes(currency)) {
    throw new InputError("Choose a currency.");
  }
  // Customer replies to emails sent from QuoteLoop go here, so it must be real.
  const email = cleanPasted(optionalString(formData.get("email"))) || null;
  if (email && !isValidEmail(email)) {
    throw new InputError("That business email doesn't look right. Check it, or leave it empty.");
  }
  const phone = cleanPasted(optionalString(formData.get("phone"))) || null;
  if (phone && phone.length > PHONE_LIMIT) {
    throw new InputError(`The phone number is too long. Keep it under ${PHONE_LIMIT} characters.`);
  }
  // Only the offered days count: a tampered form can't sneak in day 0 or 900.
  const days = formData.getAll("default_follow_up_days").map(Number);
  if (!days.some((d) => (FOLLOW_UP_DAY_OPTIONS as readonly number[]).includes(d))) {
    throw new InputError("Choose at least one follow-up day.");
  }
  return {
    business_name: required(formData, "business_name", "Enter your business name.", "The business name"),
    industry: required(formData, "industry", "Choose your type of business.", "The type of business"),
    currency,
    owner_name: required(formData, "owner_name", "Enter your name.", "Your name"),
    phone,
    email,
    default_follow_up_days: sanitizeFollowUpDays(
      days.filter((d) => (FOLLOW_UP_DAY_OPTIONS as readonly number[]).includes(d))
    ),
  };
}

function inputProblem(e: unknown): string {
  return e instanceof InputError ? e.message : "Check the details and try again.";
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
    return { error: inputProblem(e) };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("businesses").insert(payload);
  // 23505 = unique violation: the workspace already exists (e.g. a double
  // submit or a second tab). That's success, not an error.
  if (error && error.code !== "23505") {
    console.error("[settings] creating a workspace failed:", error.message);
    return { error: "Your workspace couldn't be created just now. Please try again." };
  }

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
    return { error: inputProblem(e) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .update(payload)
    .eq("user_id", user.id)
    .select("id");
  if (error) {
    console.error("[settings] saving settings failed:", error.message);
    return { error: "Your settings couldn't be saved just now. Please try again." };
  }
  if (!data?.length) return { error: "Your workspace wasn't found. Refresh the page and try again." };

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
  if (countError) {
    console.error("[settings] demo data check failed:", countError.message);
    return { error: "Sample data couldn't be loaded just now. Please try again." };
  }
  if ((count ?? 0) > 0) {
    return {
      error:
        "Sample data can only be loaded into an empty workspace. Use “Delete all data” first if you want a fresh set.",
    };
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("currency, owner_name, business_name")
    .eq("user_id", uid)
    .maybeSingle();

  const seed = buildDemoSeed(
    await requestToday(),
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
    console.error("[settings] loading demo data failed part way:", e instanceof Error ? e.message : e);
    revalidateAll();
    return {
      error: "Sample data only partly loaded. Use “Remove sample data” to clear it, then try again.",
    };
  }

  revalidateAll();
  return { ok: true, message: "Sample data loaded. Head to the Dashboard to explore it." };
}

/**
 * Deletes only the demo data: customers whose address is a sample one (demo
 * customers all use reserved example domains), with their quotes, follow-ups
 * and messages. Everything the user added themselves stays.
 */
export async function removeSampleData(): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: leads, error } = await supabase.from("leads").select("id, email").eq("user_id", user.id);
  if (error) {
    console.error("[settings] reading customers for sample removal failed:", error.message);
    return { error: "The sample data couldn't be removed just now. Please try again." };
  }
  const ids = (leads ?? []).filter((l) => isSampleAddress(l.email)).map((l) => l.id as string);
  if (!ids.length) return { ok: true, message: "There's no sample data to remove." };

  // Children first, so a failure part-way never leaves orphaned references.
  for (const table of ["messages", "follow_ups", "quotes"] as const) {
    const { error: deleteError } = await supabase.from(table).delete().eq("user_id", user.id).in("lead_id", ids);
    if (deleteError) {
      console.error(`[settings] removing sample ${table} failed:`, deleteError.message);
      revalidateAll();
      return { error: "QuoteLoop couldn't finish removing the sample data. Anything already removed stays removed. Please try again." };
    }
  }
  const { error: leadError } = await supabase.from("leads").delete().eq("user_id", user.id).in("id", ids);
  if (leadError) {
    console.error("[settings] removing sample customers failed:", leadError.message);
    revalidateAll();
    return { error: "QuoteLoop couldn't finish removing the sample data. Anything already removed stays removed. Please try again." };
  }

  revalidateAll();
  return {
    ok: true,
    message: `Sample data removed (${ids.length} sample customer${ids.length === 1 ? "" : "s"} and their quotes). Your own records were kept.`,
  };
}

/** Deletes all of the current user's leads/quotes/follow-ups/messages (keeps the workspace). */
export async function clearAllData(): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();

  // Children first, so a failure part-way never leaves orphaned references.
  const labels = { messages: "messages", follow_ups: "follow-ups", quotes: "quotes", leads: "customers" };
  for (const table of ["messages", "follow_ups", "quotes", "leads"] as const) {
    const { error } = await supabase.from(table).delete().eq("user_id", user.id);
    if (error) {
      console.error(`[settings] clearing ${table} failed:`, error.message);
      revalidateAll();
      return {
        error: `QuoteLoop couldn't finish deleting your data (it stopped at your ${labels[table]}). Anything already deleted stays deleted. Please try again.`,
      };
    }
  }

  revalidateAll();
  return {
    ok: true,
    message:
      "All customers, quotes, follow-ups and messages were deleted. Records of emails QuoteLoop already sent were kept.",
  };
}

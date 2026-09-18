"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, requireUser } from "@/lib/supabase/server";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/constants";
import { optionalString } from "@/lib/utils";
import { cleanPasted, isValidEmail } from "@/lib/email-address";
import { LIMITS } from "@/lib/quote-flows";
import { samePhone } from "@/lib/quote-write";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { ActionResult } from "@/lib/types";

export interface LeadActionState {
  ok?: boolean;
  error?: string;
  /**
   * Another of the user's customers already has this email or phone number.
   * Nothing was saved; sending the same details again saves them anyway.
   */
  duplicate?: boolean;
}

/** Longest "Source" text kept, e.g. "Referral from the Smiths". */
const SOURCE_LIMIT = 120;

function revalidateLeadViews() {
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  revalidatePath("/quotes");
  revalidatePath("/follow-ups");
}

function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
}

/** A problem with what the user typed: its message is safe to show as-is. */
class InputError extends Error {}

function limited(value: string | null, max: number, label: string): string | null {
  if (value && value.length > max) {
    throw new InputError(`${label} is too long. Keep it under ${max.toLocaleString("en-US")} characters.`);
  }
  return value;
}

function readLeadForm(formData: FormData) {
  const status = formData.get("status");
  const name = optionalString(formData.get("customer_name"));
  if (!name) throw new InputError("Enter the customer's name.");
  // Quote and follow-up emails go to this address, so it must be a real one.
  const email = cleanPasted(optionalString(formData.get("email"))) || null;
  if (email && !isValidEmail(email)) {
    throw new InputError("That email address doesn't look right. Check it, or leave it empty.");
  }
  return {
    customer_name: limited(name, LIMITS.customerName, "The customer's name")!,
    company_name: limited(optionalString(formData.get("company_name")), LIMITS.companyName, "The company name"),
    phone: limited(cleanPasted(optionalString(formData.get("phone"))) || null, LIMITS.phone, "The phone number"),
    email,
    source: limited(optionalString(formData.get("source")), SOURCE_LIMIT, "The source"),
    notes: limited(optionalString(formData.get("notes")), LIMITS.notes, "The notes"),
    status: isLeadStatus(status) ? status : ("new" as LeadStatus),
  };
}

function inputProblem(e: unknown): string {
  return e instanceof InputError ? e.message : "Check the details and try again.";
}

type Contact = { email: string | null; phone: string | null };

/**
 * Another of the user's own customers with this email (ignoring case) or this
 * phone number (however it's written). Only ever used to warn — customers are
 * never merged — and matched in code, so what was typed never becomes a query
 * filter. A failed lookup doesn't stand in the way of saving.
 */
async function customerWithSameContact(
  supabase: SupabaseClient,
  userId: string,
  contact: Contact,
  exceptId: string | null
): Promise<{ name: string; by: "email" | "phone" } | null> {
  if (!contact.email && !contact.phone) return null;
  try {
    const rows = await fetchAllRows<{ id: string; customer_name: string; email: string | null; phone: string | null }>(
      (from, to) =>
        supabase
          .from("leads")
          .select("id, customer_name, email, phone")
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to)
    );
    const others = rows.filter((r) => r.id !== exceptId);
    const email = contact.email?.toLowerCase();
    const byEmail = email ? others.find((r) => r.email?.trim().toLowerCase() === email) : undefined;
    if (byEmail) return { name: byEmail.customer_name, by: "email" };
    const byPhone = contact.phone ? others.find((r) => samePhone(r.phone, contact.phone)) : undefined;
    return byPhone ? { name: byPhone.customer_name, by: "phone" } : null;
  } catch (e) {
    console.error("[customers] duplicate check failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

function duplicateWarning(match: { name: string; by: "email" | "phone" }, editing: boolean): string {
  const what = match.by === "email" ? "this email address" : "this phone number";
  return editing
    ? `Another customer, ${match.name}, already has ${what}. If that's right, press “Save anyway”.`
    : `You already have a customer with ${what}: ${match.name}. If this is a different customer, press “Add anyway”.`;
}

/** The user saw the duplicate warning for these details and chose to save anyway. */
const allowDuplicate = (formData: FormData) => formData.get("allow_duplicate") === "1";

export async function createLead(
  _prev: LeadActionState,
  formData: FormData
): Promise<LeadActionState> {
  const user = await requireUser();

  let payload;
  try {
    payload = { ...readLeadForm(formData), user_id: user.id };
  } catch (e) {
    return { error: inputProblem(e) };
  }

  const supabase = await createClient();
  if (!allowDuplicate(formData)) {
    const contact: Contact = { email: payload.email, phone: payload.phone };
    const match = await customerWithSameContact(supabase, user.id, contact, null);
    if (match) return { duplicate: true, error: duplicateWarning(match, false) };
  }
  const { error } = await supabase.from("leads").insert(payload);
  if (error) {
    console.error("[customers] adding a customer failed:", error.message);
    return { error: "The customer couldn't be saved just now. Please try again." };
  }

  revalidateLeadViews();
  return { ok: true };
}

export async function updateLead(
  _prev: LeadActionState,
  formData: FormData
): Promise<LeadActionState> {
  const user = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "This customer no longer exists." };

  let payload;
  try {
    payload = readLeadForm(formData);
  } catch (e) {
    return { error: inputProblem(e) };
  }

  const supabase = await createClient();
  if (!allowDuplicate(formData)) {
    // Only an email or phone number being changed is checked: a customer who
    // already shared one with another shouldn't be warned on every save.
    const { data: current } = await supabase
      .from("leads")
      .select("email, phone")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (current) {
      const changed: Contact = {
        email: payload.email && payload.email.toLowerCase() !== current.email?.trim().toLowerCase() ? payload.email : null,
        phone:
          payload.phone && payload.phone !== current.phone?.trim() && !samePhone(payload.phone, current.phone)
            ? payload.phone
            : null,
      };
      const match = await customerWithSameContact(supabase, user.id, changed, id);
      if (match) return { duplicate: true, error: duplicateWarning(match, true) };
    }
  }
  const { data, error } = await supabase
    .from("leads")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  if (error) {
    console.error("[customers] updating a customer failed:", error.message);
    return { error: "The customer couldn't be saved just now. Please try again." };
  }
  if (!data?.length) {
    revalidateLeadViews();
    return { error: "This customer no longer exists. They may have been deleted in another tab." };
  }

  revalidateLeadViews();
  return { ok: true };
}

export async function deleteLead(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  // Cascades to the customer's quotes, follow-ups and messages; email records
  // are detached and kept.
  const { error } = await supabase.from("leads").delete().eq("id", String(id ?? "")).eq("user_id", user.id);
  if (error) {
    console.error("[customers] deleting a customer failed:", error.message);
    return { ok: false, error: "The customer couldn't be deleted just now. Please try again." };
  }
  revalidateLeadViews();
  return { ok: true };
}

export async function setLeadStatus(id: string, status: LeadStatus): Promise<ActionResult> {
  if (!isLeadStatus(status)) return { ok: false, error: "That isn't a stage QuoteLoop knows." };
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update({ status })
    .eq("id", String(id ?? ""))
    .eq("user_id", user.id)
    .select("id");
  if (error) {
    console.error("[customers] moving a customer failed:", error.message);
    return { ok: false, error: "The customer couldn't be moved just now. Please try again." };
  }
  revalidateLeadViews();
  if (!data?.length) return { ok: false, error: "This customer no longer exists." };
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/constants";
import { optionalString, requireString } from "@/lib/utils";

export interface LeadActionState {
  ok?: boolean;
  error?: string;
}

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

function readLeadForm(formData: FormData) {
  const status = formData.get("status");
  return {
    customer_name: requireString(formData.get("customer_name"), "Customer name"),
    company_name: optionalString(formData.get("company_name")),
    phone: optionalString(formData.get("phone")),
    email: optionalString(formData.get("email")),
    source: optionalString(formData.get("source")),
    notes: optionalString(formData.get("notes")),
    status: isLeadStatus(status) ? status : ("new" as LeadStatus),
  };
}

export async function createLead(
  _prev: LeadActionState,
  formData: FormData
): Promise<LeadActionState> {
  const user = await requireUser();

  let payload;
  try {
    payload = { ...readLeadForm(formData), user_id: user.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("leads").insert(payload);
  if (error) return { error: error.message };

  revalidateLeadViews();
  return { ok: true };
}

export async function updateLead(
  _prev: LeadActionState,
  formData: FormData
): Promise<LeadActionState> {
  const user = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing lead id." };

  let payload;
  try {
    payload = readLeadForm(formData);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidateLeadViews();
  return { ok: true };
}

export async function deleteLead(id: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  // Cascades to the lead's quotes, follow-ups and messages.
  const { error } = await supabase.from("leads").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(`Could not delete lead: ${error.message}`);
  revalidateLeadViews();
}

export async function setLeadStatus(id: string, status: LeadStatus): Promise<void> {
  if (!isLeadStatus(status)) throw new Error("Invalid lead status.");
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(`Could not move lead: ${error.message}`);
  revalidateLeadViews();
}

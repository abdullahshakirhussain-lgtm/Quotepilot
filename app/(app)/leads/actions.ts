"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
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
}

function parseLeadStatus(value: FormDataEntryValue | null): LeadStatus {
  const v = String(value ?? "new");
  return (LEAD_STATUSES as readonly string[]).includes(v)
    ? (v as LeadStatus)
    : "new";
}

export async function createLead(
  _prev: LeadActionState,
  formData: FormData
): Promise<LeadActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let payload;
  try {
    payload = {
      user_id: user.id,
      customer_name: requireString(formData.get("customer_name"), "Customer name"),
      company_name: optionalString(formData.get("company_name")),
      phone: optionalString(formData.get("phone")),
      email: optionalString(formData.get("email")),
      source: optionalString(formData.get("source")),
      notes: optionalString(formData.get("notes")),
      status: parseLeadStatus(formData.get("status")),
    };
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
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing lead id." };

  let payload;
  try {
    payload = {
      customer_name: requireString(formData.get("customer_name"), "Customer name"),
      company_name: optionalString(formData.get("company_name")),
      phone: optionalString(formData.get("phone")),
      email: optionalString(formData.get("email")),
      source: optionalString(formData.get("source")),
      notes: optionalString(formData.get("notes")),
      status: parseLeadStatus(formData.get("status")),
    };
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
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  // Cascades to the lead's quotes, follow-ups and messages.
  await supabase.from("leads").delete().eq("id", id).eq("user_id", user.id);
  revalidateLeadViews();
}

export async function setLeadStatus(id: string, status: LeadStatus): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  await supabase
    .from("leads")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidateLeadViews();
}

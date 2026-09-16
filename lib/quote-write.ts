// ---------------------------------------------------------------------------
// Server-side customer resolution for the quote flows. Every read and write is
// scoped to the signed-in user, so a quote can never be attached to someone
// else's customer (RLS enforces the same rule in the database).
// ---------------------------------------------------------------------------
import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidEmail } from "./email";
import type { CustomerRecord, QuoteFields } from "./quote-flows";
import { clip } from "./utils";

const digitsOnly = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/**
 * The chosen existing customer, or a new one created from the typed details.
 * A customer with the same email or phone is reused instead of duplicated
 * (matched in code, so user input never becomes a query filter).
 */
export async function resolveCustomerRecord(
  supabase: SupabaseClient,
  userId: string,
  f: QuoteFields
): Promise<CustomerRecord> {
  const typedEmail = f.email?.trim() || null;

  if (f.customerMode === "existing") {
    const { data, error } = await supabase
      .from("leads")
      .select("id, customer_name, email")
      .eq("id", String(f.leadId ?? ""))
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("The selected customer was not found.");

    // Fill in a missing email when the user supplied one to send the quote.
    if (typedEmail && !data.email?.trim() && isValidEmail(typedEmail)) {
      const { error: updateError } = await supabase
        .from("leads")
        .update({ email: typedEmail })
        .eq("id", data.id)
        .eq("user_id", userId);
      if (updateError) throw new Error(updateError.message);
      return { ...(data as CustomerRecord), email: typedEmail };
    }
    return data as CustomerRecord;
  }

  const name = clip(f.customerName?.trim() ?? "", 120);
  const phone = f.phone?.trim() || null;

  if (typedEmail || phone) {
    const { data: existing, error } = await supabase
      .from("leads")
      .select("id, customer_name, email, phone")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    const emailKey = typedEmail?.toLowerCase();
    const phoneKey = digitsOnly(phone);
    const match = (existing ?? []).find(
      (l) =>
        (emailKey && l.email?.trim().toLowerCase() === emailKey) ||
        (phoneKey.length >= 7 && digitsOnly(l.phone) === phoneKey)
    );
    if (match) {
      // Same customer, new quote. Add the email if we now have one.
      if (typedEmail && !match.email?.trim()) {
        const { error: updateError } = await supabase
          .from("leads")
          .update({ email: typedEmail })
          .eq("id", match.id)
          .eq("user_id", userId);
        if (updateError) throw new Error(updateError.message);
        return { id: match.id, customer_name: match.customer_name, email: typedEmail };
      }
      return { id: match.id, customer_name: match.customer_name, email: match.email ?? null };
    }
  }

  const { data: created, error: insertError } = await supabase
    .from("leads")
    .insert({
      user_id: userId,
      customer_name: name,
      company_name: clip(f.companyName?.trim() ?? "", 120) || null,
      email: typedEmail,
      phone,
      status: "new",
    })
    .select("id, customer_name, email")
    .single();
  if (insertError) throw new Error(insertError.message);
  return created as CustomerRecord;
}

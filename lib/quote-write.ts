// ---------------------------------------------------------------------------
// Server-side customer resolution for the quote flows. Every read and write is
// scoped to the signed-in user, so a quote can never be attached to someone
// else's customer (RLS enforces the same rule in the database).
// ---------------------------------------------------------------------------
import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidEmail } from "./email";
import type { CustomerRecord, QuoteFields } from "./quote-flows";
import { fetchAllRows } from "./supabase/fetch-all";
import { clip } from "./utils";

const digitsOnly = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/** Thrown when the customer picked in the form no longer exists (e.g. deleted in another tab). */
export class CustomerGoneError extends Error {
  readonly customerGone = true;
  constructor() {
    super("The selected customer was not found.");
    this.name = "CustomerGoneError";
  }
}

export function isCustomerGoneError(e: unknown): e is CustomerGoneError {
  return typeof e === "object" && e !== null && (e as { customerGone?: unknown }).customerGone === true;
}

/**
 * Whether two phone numbers are the same line. Spaces, dashes and brackets
 * don't matter, and a number written with its country code ("+94 77 123 4567",
 * "0094…") matches the same number written the local way ("077 123 4567").
 *
 * Deliberately strict, because a match reuses an existing customer: numbers
 * need 7+ digits, and the local-vs-international match only applies when one
 * of them really was written internationally, and what's left over is a 1–3
 * digit country code. Two local numbers must match digit for digit.
 */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (da.length < 7 || db.length < 7) return false;
  if (da === db) return true;
  return localMatchesInternational(a!, b!) || localMatchesInternational(b!, a!);
}

function localMatchesInternational(local: string, international: string): boolean {
  const written = international.trim();
  if (!written.startsWith("+") && !written.startsWith("00")) return false;
  const full = digitsOnly(written).replace(/^00/, "");
  // The local form, minus the one leading trunk zero many countries use.
  const national = digitsOnly(local).replace(/^0/, "");
  if (national.length < 7 || !full.endsWith(national)) return false;
  const countryCode = full.length - national.length;
  return countryCode >= 1 && countryCode <= 3;
}

type LeadRow = { id: string; customer_name: string; email: string | null; phone: string | null };

/** Every one of the user's customers, not just the first page the API returns. */
function listCustomers(supabase: SupabaseClient, userId: string): Promise<LeadRow[]> {
  return fetchAllRows<LeadRow>((from, to) =>
    supabase
      .from("leads")
      .select("id, customer_name, email, phone")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)
  );
}

/**
 * The saved customer a "new customer" entry refers to, found by email or phone,
 * without changing anything. Matched in code, so user input never becomes a
 * query filter.
 */
export async function findCustomerMatch(
  supabase: SupabaseClient,
  userId: string,
  f: Pick<QuoteFields, "email" | "phone">,
  customers?: LeadRow[]
): Promise<LeadRow | null> {
  const typedEmail = f.email?.trim() || null;
  const phone = f.phone?.trim() || null;
  if (!typedEmail && !phone) return null;

  const rows = customers ?? (await listCustomers(supabase, userId));

  const emailKey = typedEmail?.toLowerCase();
  const byEmail = emailKey ? rows.find((l) => l.email?.trim().toLowerCase() === emailKey) : undefined;
  // A shared phone number (an office line, a family phone) must never send the
  // email somewhere other than the address that was typed and previewed, so a
  // phone match only counts when that customer has no email yet or the same one.
  const byPhone = phone
    ? rows.find(
        (l) =>
          samePhone(l.phone, phone) &&
          (!emailKey || !l.email?.trim() || l.email.trim().toLowerCase() === emailKey)
      )
    : undefined;
  return byEmail ?? byPhone ?? null;
}

/**
 * A saved quote that looks like the one being added: same title (ignoring
 * case), amount and sent date, for the customer this entry would use — or, for
 * a new customer with no email or phone to match on, one with the same name.
 * Only used to warn; it never blocks and never creates anything.
 */
export async function findSimilarQuote(
  supabase: SupabaseClient,
  userId: string,
  f: QuoteFields
): Promise<{ title: string; customerName: string; sentDate: string } | null> {
  let candidates: { id: string; customer_name: string }[];
  if (f.customerMode === "existing") {
    const { data, error } = await supabase
      .from("leads")
      .select("id, customer_name")
      .eq("id", String(f.leadId ?? ""))
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    candidates = data ? [data] : [];
  } else {
    const customers = await listCustomers(supabase, userId);
    const match = await findCustomerMatch(supabase, userId, f, customers);
    const name = f.customerName?.trim().toLowerCase() ?? "";
    const nothingToMatchOn = !f.email?.trim() && !f.phone?.trim();
    candidates = match
      ? [match]
      : nothingToMatchOn
        ? customers.filter((c) => c.customer_name.trim().toLowerCase() === name)
        : [];
  }
  if (!candidates.length) return null;

  const { data, error } = await supabase
    .from("quotes")
    .select("title, amount, quote_date, lead_id")
    .eq("user_id", userId)
    .eq("quote_date", f.sentDate)
    .in(
      "lead_id",
      candidates.slice(0, 50).map((c) => c.id)
    )
    .limit(100);
  if (error) throw new Error(error.message);

  const title = f.title.trim().toLowerCase();
  const amount = Math.round(Number(String(f.amount).replace(/[, ]/g, "")) * 100);
  const hit = (data ?? []).find(
    (q) => String(q.title).trim().toLowerCase() === title && Math.round(Number(q.amount) * 100) === amount
  );
  if (!hit) return null;
  return {
    title: String(hit.title),
    customerName: candidates.find((c) => c.id === hit.lead_id)?.customer_name ?? "this customer",
    sentDate: String(hit.quote_date),
  };
}

/** How far back a same-instant twin (a second tab submitting too) is looked for. */
const TWIN_WINDOW_MS = 2 * 60_000;

type TwinRow = {
  id: string;
  title: string;
  amount: number | string;
  quote_date: string;
  lead_id: string;
  lead: { customer_name: string; email: string | null; phone: string | null } | { customer_name: string; email: string | null; phone: string | null }[] | null;
};

/**
 * Run right after a tracked quote is saved. Two tabs submitting the same quote
 * at the same instant both pass the "already added" check, so both save one.
 * Among the copies saved in the last couple of minutes for this customer (the
 * same saved customer, or one with the same email, phone, or — with neither —
 * name), with the same title, amount and sent date, the first saved is the one
 * kept. Returns that one when it isn't `quoteId`, meaning this copy should step
 * aside. Both requests read the same order, so they agree on which stays.
 */
export async function findEarlierTwin(
  supabase: SupabaseClient,
  userId: string,
  quoteId: string,
  f: QuoteFields,
  customer: CustomerRecord,
  now = Date.now()
): Promise<{ title: string; customerName: string; sentDate: string } | null> {
  const { data, error } = await supabase
    .from("quotes")
    .select("id, title, amount, quote_date, lead_id, lead:leads(customer_name, email, phone)")
    .eq("user_id", userId)
    .eq("quote_date", f.sentDate)
    .gte("created_at", new Date(now - TWIN_WINDOW_MS).toISOString())
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);

  const title = f.title.trim().toLowerCase();
  const cents = (v: unknown) => Math.round(Number(String(v).replace(/[, ]/g, "")) * 100);
  const amount = cents(f.amount);
  const email = customer.email?.trim().toLowerCase() || null;
  const phone = f.phone?.trim() || null;
  const name = customer.customer_name.trim().toLowerCase();

  const sameCustomer = (q: TwinRow) => {
    if (q.lead_id === customer.id) return true;
    // A customer picked from the list is exactly that customer.
    if (f.customerMode === "existing") return false;
    // Typed in as new: the other tab may have created its own copy of them.
    const lead = Array.isArray(q.lead) ? q.lead[0] : q.lead;
    if (!lead) return false;
    const leadEmail = lead.email?.trim().toLowerCase() || null;
    // Two different addresses are two different customers, whatever else matches.
    if (email && leadEmail) return email === leadEmail;
    if (phone && samePhone(lead.phone, phone)) return true;
    return !email && !leadEmail && !phone && !lead.phone?.trim() && lead.customer_name.trim().toLowerCase() === name;
  };

  const copies = ((data ?? []) as TwinRow[]).filter(
    (q) => String(q.title).trim().toLowerCase() === title && cents(q.amount) === amount && sameCustomer(q)
  );
  const first = copies[0];
  if (!first || first.id === quoteId || !copies.some((q) => q.id === quoteId)) return null;
  const firstLead = Array.isArray(first.lead) ? first.lead[0] : first.lead;
  return {
    title: String(first.title),
    customerName: firstLead?.customer_name ?? customer.customer_name,
    sentDate: String(first.quote_date),
  };
}

/**
 * The chosen existing customer, or a new one created from the typed details.
 * A customer with the same email or phone is reused instead of duplicated.
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
    if (!data) throw new CustomerGoneError();

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

  const match = await findCustomerMatch(supabase, userId, f);
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

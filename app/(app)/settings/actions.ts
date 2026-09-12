"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { DEFAULT_FOLLOW_UP_DAYS } from "@/lib/constants";
import { addDays, optionalString, requireString, todayISO } from "@/lib/utils";

export interface ActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

function parseFollowUpDays(formData: FormData): number[] {
  const days = formData
    .getAll("default_follow_up_days")
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);
  const unique = Array.from(new Set(days)).sort((a, b) => a - b);
  return unique.length ? unique : DEFAULT_FOLLOW_UP_DAYS;
}

export async function createBusiness(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let payload;
  try {
    payload = {
      user_id: user.id,
      business_name: requireString(formData.get("business_name"), "Business name"),
      industry: requireString(formData.get("industry"), "Industry"),
      currency: requireString(formData.get("currency"), "Currency"),
      owner_name: requireString(formData.get("owner_name"), "Your name"),
      phone: optionalString(formData.get("phone")),
      email: optionalString(formData.get("email")),
      default_follow_up_days: parseFollowUpDays(formData),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("businesses").insert(payload);
  if (error) return { error: error.message };

  redirect("/dashboard");
}

export async function updateBusiness(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let payload;
  try {
    payload = {
      business_name: requireString(formData.get("business_name"), "Business name"),
      industry: requireString(formData.get("industry"), "Industry"),
      currency: requireString(formData.get("currency"), "Currency"),
      owner_name: requireString(formData.get("owner_name"), "Your name"),
      phone: optionalString(formData.get("phone")),
      email: optionalString(formData.get("email")),
      default_follow_up_days: parseFollowUpDays(formData),
    };
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
// Demo data (generic small service businesses only)
// ---------------------------------------------------------------------------

export async function seedDemoData(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const uid = user.id;
  const today = todayISO();

  // Leads --------------------------------------------------------------------
  const leadsSeed = [
    {
      customer_name: "Marcus Reed",
      company_name: "Reed & Co Offices",
      phone: "+1 555 0142",
      email: "marcus@reedco.example",
      source: "Website form",
      notes: "Needs three split-system AC units serviced before summer.",
      status: "quote_sent",
    },
    {
      customer_name: "Priya Nair",
      company_name: "Nair Interiors",
      phone: "+1 555 0199",
      email: "priya@nairinteriors.example",
      source: "Referral",
      notes: "Full living + dining room redesign. Comparing two studios.",
      status: "negotiating",
    },
    {
      customer_name: "The Corner Bakery",
      company_name: "Corner Bakery",
      phone: "+1 555 0110",
      email: "hello@cornerbakery.example",
      source: "Walk-in",
      notes: "Wants a new illuminated shopfront sign.",
      status: "follow_up_due",
    },
    {
      customer_name: "Dana Whitfield",
      company_name: null,
      phone: "+1 555 0173",
      email: "dana.w@example.com",
      source: "Google",
      notes: "End-of-lease deep clean for a 2-bed apartment.",
      status: "won",
    },
    {
      customer_name: "Tom Alvarez",
      company_name: "Alvarez Woodworks Client",
      phone: "+1 555 0188",
      email: "tom.alvarez@example.com",
      source: "Instagram",
      notes: "Custom walnut dining table, seats 8.",
      status: "contacted",
    },
  ] as const;

  const { data: leads, error: leadErr } = await supabase
    .from("leads")
    .insert(leadsSeed.map((l) => ({ ...l, user_id: uid })))
    .select("id, customer_name");
  if (leadErr || !leads) return;

  const leadId = (name: string) =>
    leads.find((l) => l.customer_name === name)?.id;

  // Quotes -------------------------------------------------------------------
  type QSeed = {
    lead: string;
    title: string;
    description: string;
    amount: number;
    quote_date: string;
    valid_until: string | null;
    status: string;
    follow_up_count: number;
    last_follow_up_at: string | null;
    next_follow_up_at: string | null;
    notes: string | null;
  };

  const quotesSeed: QSeed[] = [
    {
      lead: "Marcus Reed",
      title: "Servicing of 3 split-system AC units",
      description:
        "Full service and gas top-up for three office AC units, including filter replacement and a 6-month check-up.",
      amount: 780,
      quote_date: addDays(today, -6),
      valid_until: addDays(today, 8),
      status: "sent",
      follow_up_count: 1,
      last_follow_up_at: addDays(today, -2) + "T09:00:00Z",
      next_follow_up_at: today + "T09:00:00Z",
      notes: "Sent PDF quote by email. Marcus asked about weekend availability.",
    },
    {
      lead: "Priya Nair",
      title: "Living + dining room redesign",
      description:
        "Concept, mood boards, furniture sourcing and styling for living and dining areas.",
      amount: 5400,
      quote_date: addDays(today, -12),
      valid_until: addDays(today, 18),
      status: "negotiating",
      follow_up_count: 2,
      last_follow_up_at: addDays(today, -3) + "T14:00:00Z",
      next_follow_up_at: addDays(today, 1) + "T14:00:00Z",
      notes: "Client wants to phase the work across two payments.",
    },
    {
      lead: "The Corner Bakery",
      title: "Illuminated shopfront sign",
      description:
        "Design, fabrication and installation of a 2.4m LED-lit fascia sign.",
      amount: 2150,
      quote_date: addDays(today, -9),
      valid_until: addDays(today, -1),
      status: "follow_up_due",
      follow_up_count: 1,
      last_follow_up_at: addDays(today, -4) + "T10:00:00Z",
      next_follow_up_at: addDays(today, -1) + "T10:00:00Z",
      notes: "Quote validity just lapsed — good candidate for an expiry nudge.",
    },
    {
      lead: "Dana Whitfield",
      title: "End-of-lease deep clean (2-bed)",
      description:
        "Full deep clean including kitchen, bathrooms, windows and carpet steam.",
      amount: 320,
      quote_date: addDays(today, -20),
      valid_until: addDays(today, -6),
      status: "accepted",
      follow_up_count: 1,
      last_follow_up_at: addDays(today, -16) + "T08:00:00Z",
      next_follow_up_at: null,
      notes: "Booked and completed. Great review left on Google.",
    },
    {
      lead: "Tom Alvarez",
      title: "Custom walnut dining table (seats 8)",
      description:
        "Solid walnut table, 2.2m, hand-finished, delivered and set up.",
      amount: 3200,
      quote_date: addDays(today, -2),
      valid_until: addDays(today, 28),
      status: "draft",
      follow_up_count: 0,
      last_follow_up_at: null,
      next_follow_up_at: null,
      notes: "Still finalising timber choice before sending.",
    },
  ];

  const { data: quotes, error: quoteErr } = await supabase
    .from("quotes")
    .insert(
      quotesSeed.map((q) => {
        const { lead, ...rest } = q;
        return {
          ...rest,
          user_id: uid,
          currency: "USD",
          lead_id: leadId(lead)!,
        };
      })
    )
    .select("id, title");
  if (quoteErr || !quotes) return;

  const quoteId = (title: string) => quotes.find((q) => q.title === title)?.id;

  // Follow-ups ---------------------------------------------------------------
  // Kept internally consistent with each quote's follow_up_count /
  // last_follow_up_at / next_follow_up_at above, and spread across all four
  // sections (completed / due today / overdue / upcoming) for the demo.
  const fuSeed = [
    // AC units — one already sent, next due today, one upcoming.
    {
      quoteTitle: "Servicing of 3 split-system AC units",
      lead: "Marcus Reed",
      due_date: addDays(today, -2),
      status: "completed",
      follow_up_number: 1,
    },
    {
      quoteTitle: "Servicing of 3 split-system AC units",
      lead: "Marcus Reed",
      due_date: today,
      status: "pending",
      follow_up_number: 2,
    },
    {
      quoteTitle: "Servicing of 3 split-system AC units",
      lead: "Marcus Reed",
      due_date: addDays(today, 4),
      status: "pending",
      follow_up_number: 3,
    },
    // Interior redesign — two sent, third upcoming.
    {
      quoteTitle: "Living + dining room redesign",
      lead: "Priya Nair",
      due_date: addDays(today, -6),
      status: "completed",
      follow_up_number: 1,
    },
    {
      quoteTitle: "Living + dining room redesign",
      lead: "Priya Nair",
      due_date: addDays(today, -3),
      status: "completed",
      follow_up_number: 2,
    },
    {
      quoteTitle: "Living + dining room redesign",
      lead: "Priya Nair",
      due_date: addDays(today, 1),
      status: "pending",
      follow_up_number: 3,
    },
    // Signage — one sent, next is overdue.
    {
      quoteTitle: "Illuminated shopfront sign",
      lead: "The Corner Bakery",
      due_date: addDays(today, -4),
      status: "completed",
      follow_up_number: 1,
    },
    {
      quoteTitle: "Illuminated shopfront sign",
      lead: "The Corner Bakery",
      due_date: addDays(today, -1),
      status: "pending",
      follow_up_number: 2,
    },
    // Deep clean — completed and accepted.
    {
      quoteTitle: "End-of-lease deep clean (2-bed)",
      lead: "Dana Whitfield",
      due_date: addDays(today, -16),
      status: "completed",
      follow_up_number: 1,
    },
  ];

  await supabase.from("follow_ups").insert(
    fuSeed.map((f) => ({
      user_id: uid,
      quote_id: quoteId(f.quoteTitle)!,
      lead_id: leadId(f.lead)!,
      due_date: f.due_date,
      status: f.status,
      follow_up_number: f.follow_up_number,
      completed_at:
        f.status === "completed" ? f.due_date + "T09:00:00Z" : null,
    }))
  );

  // One sample AI message in history ----------------------------------------
  await supabase.from("messages").insert({
    user_id: uid,
    quote_id: quoteId("Servicing of 3 split-system AC units")!,
    lead_id: leadId("Marcus Reed")!,
    message_type: "first_follow_up",
    tone: "friendly",
    content:
      "Hi Marcus,\n\nJust checking you received our quote for servicing your three AC units ($780). Happy to answer any questions or line up a weekend slot if that's easier.\n\nBest,\nQuotePilot Demo",
  });

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/quotes");
  revalidatePath("/follow-ups");
  revalidatePath("/pipeline");
  revalidatePath("/settings");
}

/** Deletes all of the current user's leads/quotes/follow-ups/messages. */
export async function clearAllData(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  // ON DELETE CASCADE handles quotes/follow-ups/messages when leads go.
  await supabase.from("messages").delete().eq("user_id", user.id);
  await supabase.from("follow_ups").delete().eq("user_id", user.id);
  await supabase.from("quotes").delete().eq("user_id", user.id);
  await supabase.from("leads").delete().eq("user_id", user.id);

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/quotes");
  revalidatePath("/follow-ups");
  revalidatePath("/pipeline");
  revalidatePath("/settings");
}

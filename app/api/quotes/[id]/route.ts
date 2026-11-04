import { NextResponse } from "next/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/quotes/<id>: everything the quote panel shows, for one of the
// signed-in user's own quotes: the quote and customer, its reminders, the
// emails sent about it and the customer's replies. Read only.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "This quote no longer exists." }, { status: 404 });

  const supabase = await createClient();
  const { data: quote, error } = await supabase
    .from("quotes")
    .select("*, lead:leads(id, customer_name, company_name, email, phone)")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[quote panel] loading a quote failed:", error.message);
    return NextResponse.json({ error: "This quote couldn't be loaded just now. Try again." }, { status: 500 });
  }
  if (!quote) return NextResponse.json({ error: "This quote no longer exists." }, { status: 404 });

  const [followUps, emails, replies] = await Promise.all([
    supabase
      .from("follow_ups")
      .select("*")
      .eq("quote_id", id)
      .eq("user_id", user.id)
      .order("due_date", { ascending: true }),
    supabase
      .from("email_logs")
      .select("id, follow_up_id, recipient_email, subject, status, created_at, sent_at")
      .eq("quote_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("customer_replies")
      .select("id, from_name, from_email, subject, received_at, auto_reply")
      .eq("quote_id", id)
      .eq("user_id", user.id)
      .order("received_at", { ascending: false }),
  ]);
  if (followUps.error) {
    console.error("[quote panel] loading reminders failed:", followUps.error.message);
    return NextResponse.json({ error: "This quote couldn't be loaded just now. Try again." }, { status: 500 });
  }
  // Optional history: a missing table (schema not re-run) shows less, not an error.
  if (emails.error) console.error("[quote panel] email history unavailable:", emails.error.message);
  if (replies.error) console.error("[quote panel] replies unavailable:", replies.error.message);

  const lead = Array.isArray(quote.lead) ? (quote.lead[0] ?? null) : (quote.lead ?? null);
  return NextResponse.json({
    quote: { ...quote, lead },
    followUps: followUps.data ?? [],
    emails: emails.error ? [] : (emails.data ?? []),
    replies: replies.error ? [] : (replies.data ?? []),
  });
}

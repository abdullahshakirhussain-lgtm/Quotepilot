import { NextResponse } from "next/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { toCSV } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ExportType = "leads" | "quotes" | "follow-ups";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type } = await params;
  const supabase = await createClient();

  let csv = "";
  let filename = "export.csv";

  if (type === ("leads" satisfies ExportType)) {
    const { data } = await supabase
      .from("leads")
      .select(
        "customer_name, company_name, phone, email, source, status, notes, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    csv = toCSV((data as Record<string, unknown>[]) ?? [], [
      "customer_name",
      "company_name",
      "phone",
      "email",
      "source",
      "status",
      "notes",
      "created_at",
    ]);
    filename = "quotepilot-leads.csv";
  } else if (type === ("quotes" satisfies ExportType)) {
    const { data } = await supabase
      .from("quotes")
      .select(
        "title, amount, currency, status, quote_date, valid_until, follow_up_count, last_follow_up_at, next_follow_up_at, notes, created_at, lead:leads(customer_name, company_name)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const rows = ((data as Record<string, unknown>[]) ?? []).map((q) => {
      const lead = Array.isArray(q.lead) ? q.lead[0] : q.lead;
      return {
        ...q,
        customer_name: (lead as { customer_name?: string })?.customer_name ?? "",
        company_name: (lead as { company_name?: string })?.company_name ?? "",
      };
    });
    csv = toCSV(rows, [
      "title",
      "customer_name",
      "company_name",
      "amount",
      "currency",
      "status",
      "quote_date",
      "valid_until",
      "follow_up_count",
      "last_follow_up_at",
      "next_follow_up_at",
      "notes",
      "created_at",
    ]);
    filename = "quotepilot-quotes.csv";
  } else if (type === ("follow-ups" satisfies ExportType)) {
    const { data } = await supabase
      .from("follow_ups")
      .select(
        "due_date, status, follow_up_number, completed_at, created_at, quote:quotes(title, amount, currency), lead:leads(customer_name)"
      )
      .eq("user_id", user.id)
      .order("due_date", { ascending: false });
    const rows = ((data as Record<string, unknown>[]) ?? []).map((f) => {
      const quote = Array.isArray(f.quote) ? f.quote[0] : f.quote;
      const lead = Array.isArray(f.lead) ? f.lead[0] : f.lead;
      return {
        quote_title: (quote as { title?: string })?.title ?? "",
        customer_name: (lead as { customer_name?: string })?.customer_name ?? "",
        amount: (quote as { amount?: number })?.amount ?? "",
        currency: (quote as { currency?: string })?.currency ?? "",
        due_date: f.due_date,
        status: f.status,
        follow_up_number: f.follow_up_number,
        completed_at: f.completed_at,
        created_at: f.created_at,
      };
    });
    csv = toCSV(rows, [
      "quote_title",
      "customer_name",
      "amount",
      "currency",
      "due_date",
      "status",
      "follow_up_number",
      "completed_at",
      "created_at",
    ]);
    filename = "quotepilot-follow-ups.csv";
  } else {
    return NextResponse.json({ error: "Unknown export type" }, { status: 404 });
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

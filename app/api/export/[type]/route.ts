import { NextResponse } from "next/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { toCSV } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Byte-order mark so Excel opens UTF-8 correctly (otherwise "—" becomes "â€”").
const BOM = "﻿";

function pickOne<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : (value ?? undefined);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type } = await params;
  const supabase = await createClient();

  let csv: string;
  let filename: string;

  if (type === "leads") {
    const { data, error } = await supabase
      .from("leads")
      .select("customer_name, company_name, phone, email, source, status, notes, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) return exportFailed(error);
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
    filename = "quoteloop-leads.csv";
  } else if (type === "quotes") {
    const { data, error } = await supabase
      .from("quotes")
      .select(
        "title, amount, currency, status, quote_date, valid_until, follow_up_count, last_follow_up_at, next_follow_up_at, notes, created_at, lead:leads(customer_name, company_name)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) return exportFailed(error);
    const rows = ((data as Record<string, unknown>[]) ?? []).map((q) => {
      const lead = pickOne(q.lead as { customer_name?: string; company_name?: string } | null);
      return {
        ...q,
        customer_name: lead?.customer_name ?? "",
        company_name: lead?.company_name ?? "",
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
    filename = "quoteloop-quotes.csv";
  } else if (type === "follow-ups") {
    const { data, error } = await supabase
      .from("follow_ups")
      .select(
        "due_date, status, follow_up_number, completed_at, message_snapshot, created_at, quote:quotes(title, amount, currency), lead:leads(customer_name)"
      )
      .eq("user_id", user.id)
      .order("due_date", { ascending: false });
    if (error) return exportFailed(error);
    const rows = ((data as Record<string, unknown>[]) ?? []).map((f) => {
      const quote = pickOne(f.quote as { title?: string; amount?: number; currency?: string } | null);
      const lead = pickOne(f.lead as { customer_name?: string } | null);
      return {
        quote_title: quote?.title ?? "",
        customer_name: lead?.customer_name ?? "",
        amount: quote?.amount ?? "",
        currency: quote?.currency ?? "",
        due_date: f.due_date,
        status: f.status,
        follow_up_number: f.follow_up_number,
        completed_at: f.completed_at,
        message_sent: f.message_snapshot,
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
      "message_sent",
      "created_at",
    ]);
    filename = "quoteloop-follow-ups.csv";
  } else {
    return NextResponse.json({ error: "Unknown export type" }, { status: 404 });
  }

  return new NextResponse(BOM + csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

function exportFailed(error: { message: string }) {
  console.error("[export] query failed:", error);
  return NextResponse.json({ error: "Export failed. Please try again." }, { status: 500 });
}

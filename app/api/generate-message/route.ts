import { NextResponse } from "next/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { generateMessage } from "@/lib/ai/provider";
import {
  MESSAGE_TYPES,
  TONES,
  type MessageType,
  type Tone,
} from "@/lib/constants";
import { clip, daysSince } from "@/lib/utils";
import { requestToday } from "@/lib/request-time";

export const dynamic = "force-dynamic";

// GET /api/generate-message?quoteId=... -> message history for that quote
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quoteId = new URL(request.url).searchParams.get("quoteId");
  if (!quoteId)
    return NextResponse.json({ error: "quoteId is required" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("quote_id", quoteId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[ai] history load failed:", error);
    return NextResponse.json({ error: "Could not load message history." }, { status: 500 });
  }
  return NextResponse.json({ messages: data ?? [] });
}

// POST /api/generate-message -> generate a follow-up message and store it
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    quoteId?: string;
    messageType?: string;
    tone?: string;
    objection?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { quoteId } = body;
  if (!quoteId)
    return NextResponse.json({ error: "quoteId is required" }, { status: 400 });

  const messageType: MessageType = (MESSAGE_TYPES as readonly string[]).includes(
    body.messageType ?? ""
  )
    ? (body.messageType as MessageType)
    : "first_follow_up";
  const tone: Tone = (TONES as readonly string[]).includes(body.tone ?? "")
    ? (body.tone as Tone)
    : "friendly";
  const objection =
    typeof body.objection === "string" ? clip(body.objection.trim(), 500) || null : null;

  const supabase = await createClient();

  // Fetch the quote + its lead, scoped to the current user (RLS also enforces this).
  const { data: quote, error: quoteErr } = await supabase
    .from("quotes")
    .select(
      "id, lead_id, title, description, amount, currency, quote_date, follow_up_count, lead:leads(customer_name)"
    )
    .eq("id", quoteId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (quoteErr || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("business_name, industry, owner_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const lead = Array.isArray(quote.lead) ? quote.lead[0] : quote.lead;

  // Every field is clipped: stored text is unbounded, and each character here
  // is billed by the AI provider.
  const result = await generateMessage({
    businessName: clip(business?.business_name, 120) || "Our business",
    industry: clip(business?.industry, 80) || "Services",
    ownerName: clip(business?.owner_name, 80) || null,
    customerName: clip(lead?.customer_name, 120) || "there",
    quoteTitle: clip(quote.title, 200),
    quoteDescription: clip(quote.description, 1500) || null,
    quoteAmount: Number(quote.amount),
    currency: quote.currency,
    quoteDate: quote.quote_date,
    daysSinceSent: daysSince(quote.quote_date, await requestToday()),
    previousFollowUpCount: quote.follow_up_count ?? 0,
    tone,
    messageType,
    objection,
  });

  // Store the generated draft in history.
  const { data: saved, error: saveError } = await supabase
    .from("messages")
    .insert({
      user_id: user.id,
      quote_id: quote.id,
      lead_id: quote.lead_id,
      message_type: messageType,
      tone,
      content: result.content,
    })
    .select("*")
    .single();
  if (saveError) console.error("[ai] saving message history failed:", saveError);

  return NextResponse.json({
    message: saved,
    content: result.content,
    provider: result.provider,
    fellBack: result.fellBack,
    error: result.error ?? null,
    historySaved: !saveError,
  });
}

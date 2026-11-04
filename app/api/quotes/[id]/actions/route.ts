import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  answerCustomerReply,
  deleteQuote,
  setQuoteStatus,
  undoQuoteClose,
  type QuoteCloseUndo,
  type ReplyAnswer,
} from "@/app/(app)/quotes/actions";
import type { QuoteStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

// POST /api/quotes/<id>/actions: the quote panel's buttons. The same server
// functions the rest of the app uses, called as a plain request rather than a
// server action: on the dashboard and settings pages a server action's page
// refresh can stall (Next 15.5), and every later action then queues behind
// it. The panel reloads the page underneath itself when it closes instead.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // JSON only: a page on another site can't send this without the browser
  // asking first, so it can't press these buttons for a signed-in user.
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ ok: false, error: "That request wasn't understood." }, { status: 415 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "You've been signed out. Sign in again and retry." }, { status: 401 });
  const { id } = await params;

  let body: { op?: string; status?: string; answer?: string; undo?: QuoteCloseUndo };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "That request wasn't understood." }, { status: 400 });
  }

  switch (body.op) {
    case "status":
      if (!["accepted", "rejected", "negotiating", "expired"].includes(String(body.status))) break;
      return NextResponse.json(await setQuoteStatus(id, body.status as QuoteStatus));
    case "undo":
      if (!body.undo || typeof body.undo !== "object") break;
      return NextResponse.json(await undoQuoteClose(id, body.undo));
    case "answer":
      return NextResponse.json(await answerCustomerReply(id, body.answer as ReplyAnswer));
    case "delete":
      return NextResponse.json(await deleteQuote(id));
  }
  return NextResponse.json({ ok: false, error: "That isn't something QuoteLoop can do to a quote." }, { status: 400 });
}

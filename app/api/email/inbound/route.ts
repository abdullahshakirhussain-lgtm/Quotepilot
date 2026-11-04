import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfig, formatFrom, isValidEmail } from "@/lib/email";
import { recomputeQuoteFollowUpState } from "@/lib/quote-state";
import { OPEN_QUOTE_STATUSES } from "@/lib/metrics";
import { notify } from "@/lib/notifications";
import {
  forwardSubject,
  forwardText,
  htmlToText,
  isAutoReply,
  MAX_FORWARD_ATTACHMENT_BYTES,
  MAX_REPLIES_PER_TOKEN_PER_DAY,
  MAX_STORED_REPLY,
  parseMailbox,
  replySnippet,
  relayConfig,
  tokenFromAddress,
  verifyWebhook,
} from "@/lib/reply-relay";

export const dynamic = "force-dynamic";

// POST /api/email/inbound: Resend's "email.received" webhook. A customer
// replied to an email sent from QuoteLoop: record who and when, pause the
// quote's reminders, and forward the reply to the business email.
//
// Answers 2xx once a reply is handled or deliberately ignored, and 5xx when
// something worth retrying failed (Resend retries for about a day). Each
// reply is handled once (customer_replies.resend_email_id) and forwarded at
// most once (the forward's Idempotency-Key).

const RESEND_API = "https://api.resend.com";
const TIMEOUT_MS = 15_000;
const MAX_BODY = 1_000_000;

const ok = (note: string) => NextResponse.json({ ok: true, note });
const retry = (note: string) => NextResponse.json({ error: note }, { status: 502 });
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const clip = (v: string | null | undefined, n: number) => (v ? v.slice(0, n) : null);

async function resendGet<T>(apiKey: string, path: string): Promise<T | null> {
  try {
    const res = await fetch(`${RESEND_API}${path}`, {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[replies] Resend ${path.split("/").slice(0, 3).join("/")} returned ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.error("[replies] Resend couldn't be reached:", e instanceof Error ? e.message : e);
    return null;
  }
}

interface ReceivedEmail {
  subject?: string | null;
  text?: string | null;
  html?: string | null;
  headers?: Record<string, unknown> | null;
  reply_to?: string[] | null;
  message_id?: string | null;
}
interface ReceivedAttachment {
  filename?: string | null;
  size?: number | null;
  download_url?: string | null;
}

export async function POST(request: Request) {
  const relay = relayConfig();
  const mail = emailConfig();
  const db = createAdminClient();
  if (!relay || !mail || !db) return NextResponse.json({ error: "Replies aren't set up." }, { status: 503 });

  const raw = await request.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "Too large." }, { status: 413 });
  const signed = verifyWebhook(
    {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    },
    raw,
    relay.webhookSecret
  );
  if (!signed) return NextResponse.json({ error: "Invalid signature." }, { status: 401 });

  let event: { type?: unknown; created_at?: unknown; data?: Record<string, unknown> };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (event?.type !== "email.received" || !event.data) return ok("not a received email");
  const data = event.data;
  const emailId = typeof data.email_id === "string" ? data.email_id.slice(0, 100) : "";
  if (!emailId) return ok("no email id");

  // Which reply address it was sent to (To, Cc, or the envelope recipient).
  const token = [...list(data.to), ...list(data.cc), ...list(data.received_for)]
    .map((address) => tokenFromAddress(address, relay.domain))
    .find(Boolean);
  if (!token) return ok("not a reply address");

  const { data: owner, error: tokenError } = await db
    .from("reply_tokens")
    .select("user_id, quote_id")
    .eq("token", token)
    .maybeSingle();
  if (tokenError) {
    console.error("[replies] reply address lookup failed:", tokenError.message);
    return retry("lookup failed");
  }
  if (!owner) return ok("unknown reply address");
  const userId = owner.user_id as string;
  const quoteId = (owner.quote_id as string | null) ?? null;

  const { data: existing, error: existingError } = await db
    .from("customer_replies")
    .select("id, forwarded_at")
    .eq("resend_email_id", emailId)
    .maybeSingle();
  if (existingError) {
    console.error("[replies] couldn't check for an earlier delivery:", existingError.message);
    return retry("lookup failed");
  }
  if (existing?.forwarded_at) return ok("already handled");

  const envelopeFrom = parseMailbox(typeof data.from === "string" ? data.from : "");
  // Never loop: mail from QuoteLoop's own addresses is ignored.
  const ownAddress = parseMailbox(mail.from).email;
  if (!isValidEmail(envelopeFrom.email) || envelopeFrom.email === ownAddress || envelopeFrom.email.endsWith(`@${relay.domain}`)) {
    return ok("ignored sender");
  }

  // A reply address that leaked (pasted into a mailing list, say) can't flood
  // the business's inbox or QuoteLoop's sending allowance.
  if (!existing) {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    let recent = db.from("customer_replies").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("received_at", since);
    recent = quoteId ? recent.eq("quote_id", quoteId) : recent.is("quote_id", null);
    const { count, error } = await recent;
    if (!error && (count ?? 0) >= MAX_REPLIES_PER_TOKEN_PER_DAY) {
      console.error("[replies] too many replies to one address today; ignored one");
      return ok("daily limit");
    }
  }

  // The webhook carries only metadata: the text comes from Resend's API.
  const full = await resendGet<ReceivedEmail>(relay.apiKey, `/emails/receiving/${encodeURIComponent(emailId)}`);
  if (!full) return retry("couldn't read the email");
  const subject = full.subject ?? (typeof data.subject === "string" ? data.subject : null);
  const fromHeader = typeof full.headers?.from === "string" ? parseMailbox(full.headers.from) : null;
  const replyTo = parseMailbox(list(full.reply_to)[0] ?? "");
  const answerTo = isValidEmail(replyTo.email) ? replyTo.email : envelopeFrom.email;
  const autoReply = isAutoReply(full.headers, subject);

  const [quoteRes, businessRes] = await Promise.all([
    quoteId
      ? db.from("quotes").select("id, title, status, customer_replied_at, lead:leads(customer_name)").eq("id", quoteId).eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db.from("businesses").select("business_name, email").eq("user_id", userId).maybeSingle(),
  ]);
  if (quoteRes.error || businessRes.error) {
    console.error("[replies] couldn't load the quote or business:", (quoteRes.error ?? businessRes.error)?.message);
    return retry("lookup failed");
  }
  const quote = quoteRes.data as { id: string; title: string; status: string; customer_replied_at: string | null; lead: { customer_name?: string } | { customer_name?: string }[] | null } | null;
  const lead = Array.isArray(quote?.lead) ? quote?.lead[0] : quote?.lead;
  const customerName = fromHeader?.name ?? envelopeFrom.name ?? lead?.customer_name ?? null;
  const replyText = full.text?.trim() ? full.text : htmlToText(full.html ?? "");
  const messageId =
    (typeof full.message_id === "string" && full.message_id) || (typeof data.message_id === "string" && data.message_id) || null;
  const attachmentNames = Array.isArray(data.attachments)
    ? (data.attachments as { filename?: unknown }[])
        .map((a) => (typeof a?.filename === "string" ? a.filename.slice(0, 200) : ""))
        .filter(Boolean)
        .slice(0, 20)
    : [];

  // Record it once. A retry of the same delivery finds this row and only
  // finishes the forward.
  if (!existing) {
    const { error } = await db.from("customer_replies").insert({
      user_id: userId,
      quote_id: quote?.id ?? null,
      resend_email_id: emailId,
      from_email: envelopeFrom.email.slice(0, 320),
      from_name: clip(customerName, 200),
      subject: clip(subject, 300),
      // The reply itself, so it can be read and answered inside QuoteLoop.
      body: replyText.slice(0, MAX_STORED_REPLY) || null,
      message_id: messageId ? messageId.slice(0, 500) : null,
      attachment_names: attachmentNames.length ? attachmentNames : null,
      auto_reply: autoReply,
      received_at: typeof data.created_at === "string" && !Number.isNaN(Date.parse(data.created_at)) ? data.created_at : new Date().toISOString(),
    });
    if (error && error.code !== "23505") {
      console.error("[replies] couldn't record a reply:", error.message);
      return retry("record failed");
    }
  }

  // A real reply to an open quote pauses its reminders, so the customer isn't
  // chased while a conversation is going on. The owner decides what's next.
  // A retried delivery already paused them on its first attempt.
  let reminders: "paused" | "unchanged" | "auto_reply" = autoReply
    ? "auto_reply"
    : existing && quote?.customer_replied_at
      ? "paused"
      : "unchanged";
  if (!existing && !autoReply && quote && (OPEN_QUOTE_STATUSES as readonly string[]).includes(quote.status)) {
    try {
      const { data: paused, error } = await db
        .from("follow_ups")
        .update({ status: "skipped", paused_by_reply: true })
        .eq("quote_id", quote.id)
        .eq("user_id", userId)
        .eq("status", "pending")
        .select("id");
      if (error) throw new Error(error.message);
      const { error: flagError } = await db
        .from("quotes")
        .update({ customer_replied_at: new Date().toISOString() })
        .eq("id", quote.id)
        .eq("user_id", userId);
      if (flagError) throw new Error(flagError.message);
      await recomputeQuoteFollowUpState(db, userId, quote.id);
      if (paused?.length) reminders = "paused";
    } catch (e) {
      // The reply is still forwarded; pausing is best effort.
      console.error("[replies] couldn't pause reminders:", e instanceof Error ? e.message : e);
    }
  }

  const who = customerName ?? envelopeFrom.email;
  const about = quote?.title ? ` about ${quote.title}` : "";
  await notify(db, {
    userId,
    kind: autoReply ? "auto_reply" : "customer_reply",
    title: autoReply ? `${who} sent an automatic reply${about}` : `${who} replied${about}`,
    body: replySnippet(replyText) || (subject ?? null),
    quoteId: quote?.id ?? null,
    dedupeKey: `reply:${emailId}`,
  });

  const businessEmail = (businessRes.data?.email as string | null | undefined)?.trim() ?? "";
  if (!isValidEmail(businessEmail)) {
    await db.from("customer_replies").update({ forward_error: "No business email in Settings" }).eq("resend_email_id", emailId);
    await notify(db, {
      userId,
      kind: "forward_failed",
      title: `${who}'s reply couldn't be forwarded to your email`,
      body: "There's no business email in Settings. You can read the reply here; add your email in Settings so the next ones reach your inbox too.",
      quoteId: quote?.id ?? null,
      dedupeKey: `forward-failed:${emailId}`,
    });
    return ok("no business email to forward to");
  }

  // Attachments, up to a total size; larger ones are named in the forward.
  const attachments: { filename: string; content: string }[] = [];
  const skipped: string[] = [];
  if (Array.isArray(data.attachments) && data.attachments.length > 0) {
    const found = await resendGet<{ data?: ReceivedAttachment[] }>(relay.apiKey, `/emails/receiving/${encodeURIComponent(emailId)}/attachments`);
    if (!found) return retry("couldn't list attachments");
    let total = 0;
    for (const a of found.data ?? []) {
      const filename = (a.filename ?? "attachment").replace(/[\r\n"]/g, "").slice(0, 200) || "attachment";
      const size = Number(a.size ?? 0);
      if (!a.download_url || total + size > MAX_FORWARD_ATTACHMENT_BYTES) {
        skipped.push(filename);
        continue;
      }
      try {
        const res = await fetch(a.download_url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const bytes = Buffer.from(await res.arrayBuffer());
        if (total + bytes.length > MAX_FORWARD_ATTACHMENT_BYTES) {
          skipped.push(filename);
          continue;
        }
        total += bytes.length;
        attachments.push({ filename, content: bytes.toString("base64") });
      } catch (e) {
        console.error("[replies] couldn't download an attachment:", e instanceof Error ? e.message : e);
        return retry("attachment download failed");
      }
    }
  }

  const text = forwardText({
    customerName,
    customerEmail: answerTo,
    quoteTitle: quote?.title ?? null,
    text: replyText,
    skippedAttachments: skipped,
    reminders,
  });

  let sent: Response | null = null;
  try {
    sent = await fetch(`${RESEND_API}/emails`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${mail.apiKey}`,
        "content-type": "application/json",
        // A retried delivery never forwards the same reply twice.
        "idempotency-key": `fwd-${emailId}`,
      },
      body: JSON.stringify({
        from: formatFrom(mail.from, customerName ?? answerTo),
        to: [businessEmail],
        reply_to: answerTo,
        subject: forwardSubject(subject, quote?.title ?? null),
        text,
        ...(attachments.length ? { attachments } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    console.error("[replies] forwarding failed:", e instanceof Error ? e.message : e);
  }
  if (!sent?.ok) {
    const detail = sent ? `Resend returned ${sent.status}` : "Resend couldn't be reached";
    if (sent) console.error("[replies] forward refused:", (await sent.text().catch(() => "")).slice(0, 300));
    await db.from("customer_replies").update({ forward_error: detail }).eq("resend_email_id", emailId);
    return retry("forward failed");
  }

  await db
    .from("customer_replies")
    .update({ forwarded_at: new Date().toISOString(), forward_error: null })
    .eq("resend_email_id", emailId);
  return ok(reminders === "paused" ? "forwarded, reminders paused" : "forwarded");
}

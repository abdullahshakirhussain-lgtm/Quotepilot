import { formatCurrency } from "../utils";
import type { MessageType, Tone } from "../constants";
import { MESSAGE_TYPE_LABELS, TONE_LABELS } from "../constants";

export interface MessageContext {
  businessName: string;
  industry: string;
  ownerName?: string | null;
  customerName: string;
  quoteTitle: string;
  quoteDescription?: string | null;
  quoteAmount: number;
  currency: string;
  quoteDate: string;
  daysSinceSent: number;
  previousFollowUpCount: number;
  tone: Tone;
  messageType: MessageType;
  objection?: string | null;
}

// Per message-type guidance that shapes the ask and framing.
const TYPE_INSTRUCTIONS: Record<MessageType, string> = {
  first_follow_up:
    "This is a first, gentle check-in a few days after the quote was sent. Confirm they received it, offer to answer questions, and keep it light and low-pressure.",
  second_follow_up:
    "This is a second follow-up. Add a little more value or urgency than the first: reiterate one key benefit and gently ask if they'd like to move forward or have questions.",
  final_follow_up:
    "This is a final follow-up after several attempts. Be polite and respectful, acknowledge they may be busy, and make it easy to say yes, no, or 'not right now'. Signal this is your last check-in for now.",
  quote_expiring:
    "The quote is approaching its validity/expiry date. Politely remind them the pricing is time-limited and invite them to confirm before it expires.",
  objection_response:
    "The customer raised a concern or objection (provided below). Acknowledge it genuinely, respond helpfully without being defensive or pushy, and offer a concrete next step.",
  lost_lead_recovery:
    "This lead went cold or was marked lost a while ago. Re-open the conversation warmly, with no pressure, and leave the door open in case timing or needs have changed.",
  thank_you_after_acceptance:
    "The customer just accepted the quote. Thank them warmly, confirm the next step, and set a friendly, confident tone for the work ahead.",
};

export function buildSystemPrompt(): string {
  return [
    "You write short follow-up messages that a small service business sends to a prospective customer about a price quote.",
    "Rules:",
    "- Write ONLY the message body, ready to paste into an email, text message or messaging app. No subject line, no preamble, no sign-off placeholders like [Your Name] unless a name is given.",
    "- Keep it concise: 2–5 sentences. Sound like a real person, not a marketing bot.",
    "- Never invent facts, discounts, dates, or details that were not provided.",
    "- Do not fabricate previous conversations. Match the requested tone.",
    "- Be respectful of the customer's time and never manipulative or aggressive.",
    "- Use the customer's first name naturally if provided. Sign off with the business or owner name if provided.",
  ].join("\n");
}

export function buildUserPrompt(ctx: MessageContext): string {
  const lines: string[] = [];
  lines.push(`Message type: ${MESSAGE_TYPE_LABELS[ctx.messageType]}`);
  lines.push(`Guidance: ${TYPE_INSTRUCTIONS[ctx.messageType]}`);
  lines.push(`Desired tone: ${TONE_LABELS[ctx.tone]}`);
  lines.push("");
  lines.push("Context:");
  lines.push(`- Business: ${ctx.businessName} (${ctx.industry})`);
  if (ctx.ownerName) lines.push(`- Sender / owner name: ${ctx.ownerName}`);
  lines.push(`- Customer name: ${ctx.customerName}`);
  lines.push(`- Quote title: ${ctx.quoteTitle}`);
  if (ctx.quoteDescription) lines.push(`- Quote details: ${ctx.quoteDescription}`);
  lines.push(`- Quote amount: ${formatCurrency(ctx.quoteAmount, ctx.currency)}`);
  lines.push(`- Quote sent on: ${ctx.quoteDate}`);
  lines.push(`- Days since the quote was sent: ${ctx.daysSinceSent}`);
  lines.push(`- Previous follow-ups already sent: ${ctx.previousFollowUpCount}`);
  if (ctx.objection && ctx.messageType === "objection_response") {
    lines.push(`- Customer's objection / concern: ${ctx.objection}`);
  } else if (ctx.objection) {
    lines.push(`- Extra context to weave in: ${ctx.objection}`);
  }
  lines.push("");
  lines.push("Write the message now.");
  return lines.join("\n");
}

/**
 * Deterministic template used when no AI key is configured, or if the AI
 * request fails. Keeps QuoteLoop fully demoable offline.
 */
export function templateFallback(ctx: MessageContext): string {
  const first = ctx.customerName.split(" ")[0] || ctx.customerName;
  const sign = ctx.ownerName ? `${ctx.ownerName}, ${ctx.businessName}` : ctx.businessName;
  const amount = formatCurrency(ctx.quoteAmount, ctx.currency);

  const bodyByType: Record<MessageType, string> = {
    first_follow_up: `Just checking you received our quote for "${ctx.quoteTitle}" (${amount}). Happy to answer any questions or walk you through the details whenever suits you.`,
    second_follow_up: `Following up on the quote for "${ctx.quoteTitle}" (${amount}). We'd love to help with this — is there anything you'd like clarified before moving forward?`,
    final_follow_up: `I don't want to crowd your inbox, so this is my last check-in on the "${ctx.quoteTitle}" quote (${amount}) for now. If the timing isn't right, no problem at all — just let me know and I'll leave it with you.`,
    quote_expiring: `A quick heads-up that our quote for "${ctx.quoteTitle}" (${amount}) is coming up on its validity date. If you'd like to go ahead at this price, just reply and we'll get it locked in.`,
    objection_response: `Thanks for sharing your thoughts on the "${ctx.quoteTitle}" quote${ctx.objection ? ` — I hear you on ${ctx.objection.toLowerCase()}` : ""}. Let's find something that works: happy to talk options or adjust the scope so it fits what you need.`,
    lost_lead_recovery: `It's been a little while since we shared the quote for "${ctx.quoteTitle}". No pressure at all — I just wanted to check in and see if the timing is better now or if your needs have changed. Always glad to help.`,
    thank_you_after_acceptance: `Thank you for going ahead with "${ctx.quoteTitle}" — we really appreciate it! I'll be in touch shortly with the next steps so we can get started.`,
  };

  return `Hi ${first},\n\n${bodyByType[ctx.messageType]}\n\nBest,\n${sign}`;
}

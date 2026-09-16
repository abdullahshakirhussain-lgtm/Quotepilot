// ---------------------------------------------------------------------------
// The quote email itself: subject and body. Kept dependency-free so the browser
// preview and the server send compose exactly the same text.
// The short "why you got this" footer is added when sending (see lib/email.ts).
// ---------------------------------------------------------------------------
import { formatCurrency, formatDate } from "./utils";

export interface QuoteEmailContext {
  customerName: string;
  businessName: string;
  ownerName?: string | null;
  title: string;
  amount: number;
  currency: string;
  description?: string | null;
  validUntil?: string | null;
}

/** e.g. "Quote from Northside Home Services: AC servicing" */
export function defaultQuoteSubject(businessName: string, title: string): string {
  const business = businessName.trim();
  const subject = business ? `Quote from ${business}: ${title}` : `Your quote: ${title}`;
  return subject.slice(0, 200);
}

/** A short, plain quote email the user can edit before sending. */
export function defaultQuoteBody(ctx: QuoteEmailContext): string {
  const name = ctx.customerName.trim();
  const first = name.split(" ")[0] || name || "there";
  const business = ctx.businessName.trim();
  const owner = ctx.ownerName?.trim();

  const lines = [`Hi ${first},`, "", `Thanks for asking us about ${ctx.title.trim()}. Here's our quote:`, ""];
  lines.push(`${ctx.title.trim()} — ${formatCurrency(ctx.amount, ctx.currency)}`);

  const description = ctx.description?.trim();
  if (description) lines.push("", description);
  if (ctx.validUntil) lines.push("", `This quote is valid until ${formatDate(ctx.validUntil)}.`);

  lines.push("", "Just reply to this email if you'd like to go ahead, or if you have any questions.", "");
  lines.push("Thanks,");
  lines.push(owner ? (business ? `${owner}, ${business}` : owner) : business);

  return lines.join("\n").trim();
}

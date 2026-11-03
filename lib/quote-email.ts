// ---------------------------------------------------------------------------
// The quote email itself: subject and body. Kept dependency-free so the browser
// preview and the server send compose exactly the same text.
// The short "why you got this" footer is added when sending (see lib/email.ts).
// ---------------------------------------------------------------------------
import { fillSubject, fillTemplate } from "./templates";
import { builtinByKey, STANDARD_QUOTE_KEY } from "./template-library";

export interface QuoteEmailContext {
  customerName: string;
  businessName: string;
  ownerName?: string | null;
  title: string;
  amount: number;
  currency: string;
  description?: string | null;
  validUntil?: string | null;
  quoteDate?: string | null;
  /** From Settings; defaults apply when not set. */
  signOff?: string | null;
  signature?: string | null;
}

/** e.g. "Quote from Northside Home Services: AC servicing" */
export function defaultQuoteSubject(businessName: string, title: string): string {
  const business = businessName.trim();
  const subject = business ? `Quote from ${business}: ${title}` : `Your quote: ${title}`;
  return subject.slice(0, 200);
}

/** The standard quote email (the ready-made "Standard quote email"). */
export function defaultQuoteBody(ctx: QuoteEmailContext): string {
  return fillTemplate(builtinByKey(STANDARD_QUOTE_KEY)!.body, { ...ctx, title: ctx.title.trim() });
}

/**
 * Subject and body for a quote email from a template, or the standard wording
 * when there is none. A template without a subject, or one that fills to
 * nothing, keeps the standard subject.
 */
export function composeQuoteEmail(
  ctx: QuoteEmailContext,
  template?: { subject: string | null; body: string } | null
): { subject: string; body: string } {
  const standardSubject = defaultQuoteSubject(ctx.businessName, ctx.title.trim());
  if (!template) return { subject: standardSubject, body: defaultQuoteBody(ctx) };
  const values = { ...ctx, title: ctx.title.trim() };
  return { subject: fillSubject(template.subject, values) || standardSubject, body: fillTemplate(template.body, values) };
}

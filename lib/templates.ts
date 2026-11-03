// ---------------------------------------------------------------------------
// Message templates: QuoteLoop's ready-made wording (lib/template-library.ts),
// the user's edited copies of it, and templates they write themselves.
// Bracketed words like [First name] are filled in from each quote. Kept
// dependency-free so the editor preview, the writers and the server agree.
// ---------------------------------------------------------------------------
import { formatCurrency, formatDate } from "./utils";
import { BUILTIN_TEMPLATES, STANDARD_QUOTE_KEY, builtinByKey } from "./template-library";
import type { MessageType } from "./constants";

export const TEMPLATE_KINDS = ["quote_email", "follow_up"] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export const TEMPLATE_KIND_LABELS: Record<TemplateKind, string> = {
  quote_email: "Quote email",
  follow_up: "Follow-up",
};

/** A row in message_templates: an edited ready-made template, or the user's own. */
export interface MessageTemplate {
  id: string;
  kind: TemplateKind;
  name: string;
  subject: string | null;
  body: string;
  /** Set when this is the user's copy of a ready-made template. */
  builtin_key: string | null;
  updated_at: string;
}

/** A template as offered to the user: ready-made (maybe edited) or their own. */
export interface ResolvedTemplate {
  /** The ready-made key, or the row id for the user's own. */
  id: string;
  kind: TemplateKind;
  name: string;
  subject: string | null;
  body: string;
  builtinKey: string | null;
  messageType: MessageType | null;
  /** A ready-made template the user changed. */
  edited: boolean;
  /** The saved row, if any (an edit, or the user's own). */
  rowId: string | null;
}

/** Same limits as the database checks in supabase/schema.sql. */
export const TEMPLATE_LIMITS = { name: 80, subject: 200, body: 5000, perAccount: 30, signOff: 40, signature: 300 } as const;

export interface TemplateValues {
  customerName: string;
  title: string;
  amount: number;
  currency: string;
  description?: string | null;
  validUntil?: string | null;
  quoteDate?: string | null;
  ownerName?: string | null;
  businessName: string;
  /** From Settings; "Thanks," when not set. */
  signOff?: string | null;
  /** From Settings; the name and business name when not set. */
  signature?: string | null;
}

/** The words a template can use, in the order the editor offers them. */
export const TEMPLATE_TOKENS = [
  { token: "[First name]", hint: "Customer's first name" },
  { token: "[Customer name]", hint: "Customer's full name" },
  { token: "[Job]", hint: "Quote title" },
  { token: "[Price]", hint: "Quote amount with currency" },
  { token: "[Details]", hint: "Quote details, if any" },
  { token: "[Valid until]", hint: "Valid-until date, if any" },
  { token: "[Quote date]", hint: "Date the quote was sent" },
  { token: "[Sign-off]", hint: "Your sign-off from Settings, like Thanks," },
  { token: "[Signature]", hint: "Your signature from Settings" },
  { token: "[Your name]", hint: "Your name from Settings" },
  { token: "[Business name]", hint: "Your business name" },
] as const;

export const DEFAULT_SIGN_OFF = "Thanks,";

/** The sign-off and signature as they are filled in, with their defaults. */
export function signatureParts(v: { signOff?: string | null; signature?: string | null; ownerName?: string | null; businessName: string }) {
  const owner = v.ownerName?.trim() ?? "";
  const business = v.businessName.trim();
  return {
    signOff: v.signOff?.trim() || DEFAULT_SIGN_OFF,
    signature: v.signature?.trim() || (owner ? (business ? `${owner}, ${business}` : owner) : business),
  };
}

/** Tokens that can be empty: a line using one is left out when it is. */
const OPTIONAL = new Set(["details", "valid until", "quote date", "your name", "signature"]);

const TOKEN =
  /\[(first name|customer name|job|price|details|valid until|quote date|sign-off|signature|your name|business name)\]/gi;

function valueOf(key: string, v: TemplateValues): string {
  const name = v.customerName.trim();
  switch (key) {
    case "first name":
      return name.split(/\s+/)[0] || name || "there";
    case "customer name":
      return name || "there";
    case "job":
      return v.title.trim();
    case "price":
      return formatCurrency(v.amount, v.currency);
    case "details":
      return v.description?.trim() ?? "";
    case "valid until":
      return v.validUntil ? formatDate(v.validUntil) : "";
    case "quote date":
      return v.quoteDate ? formatDate(v.quoteDate) : "";
    case "sign-off":
      return signatureParts(v).signOff;
    case "signature":
      return signatureParts(v).signature;
    case "your name":
      return v.ownerName?.trim() ?? "";
    case "business name":
      return v.businessName.trim();
    default:
      return "";
  }
}

/**
 * Fills a template's bracketed words from a quote. A line that uses
 * [Details], [Valid until], [Quote date], [Your name] or [Signature] is left
 * out when there is no such value, so the email never says "valid until ."
 * Other brackets are left exactly as written.
 */
export function fillTemplate(text: string, values: TemplateValues): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    let drop = false;
    const filled = line.replace(TOKEN, (_m, raw: string) => {
      const key = raw.toLowerCase();
      const value = valueOf(key, values);
      if (!value && OPTIONAL.has(key)) drop = true;
      return value;
    });
    if (!drop) kept.push(filled);
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** A subject line from a template: one line, at most 200 characters. */
export function fillSubject(text: string | null | undefined, values: TemplateValues): string {
  return text ? fillTemplate(text, values).replace(/\s+/g, " ").trim().slice(0, 200) : "";
}

/**
 * Everything the user can pick, in order: the ready-made templates (their
 * edited copy where there is one), then their own, oldest first.
 */
export function resolveTemplates(rows: MessageTemplate[], kind?: TemplateKind): ResolvedTemplate[] {
  const edits = new Map(rows.filter((r) => r.builtin_key).map((r) => [r.builtin_key as string, r]));
  const builtins = BUILTIN_TEMPLATES.map((b): ResolvedTemplate => {
    const edit = edits.get(b.key);
    return {
      id: b.key,
      kind: b.kind,
      name: b.name,
      subject: edit ? edit.subject : b.subject,
      body: edit ? edit.body : b.body,
      builtinKey: b.key,
      messageType: b.messageType,
      edited: Boolean(edit),
      rowId: edit?.id ?? null,
    };
  });
  const own = rows
    .filter((r) => !r.builtin_key)
    .map((r): ResolvedTemplate => ({
      id: r.id,
      kind: r.kind,
      name: r.name,
      subject: r.subject,
      body: r.body,
      builtinKey: null,
      messageType: null,
      edited: false,
      rowId: r.id,
    }));
  const all = [...builtins, ...own];
  return kind ? all.filter((t) => t.kind === kind) : all;
}

/** The quote email template used for new quotes: the chosen one, else the standard. */
export function defaultQuoteTemplateId(choice: string | null | undefined, templates: ResolvedTemplate[]): string {
  return templates.some((t) => t.id === choice && t.kind === "quote_email") ? (choice as string) : STANDARD_QUOTE_KEY;
}

/** The ready-made follow-up written for a step. */
export function templateForStep(type: MessageType, templates: ResolvedTemplate[]): ResolvedTemplate | undefined {
  return templates.find((t) => t.messageType === type);
}

/** Text a brand-new template of this kind starts from. */
export function starterFor(kind: TemplateKind) {
  const b = builtinByKey(kind === "quote_email" ? STANDARD_QUOTE_KEY : "first_follow_up")!;
  return { subject: b.subject, body: b.body };
}

/** Real sample details for the editor preview (from the demo data). */
export function previewValues(
  business: { name: string; ownerName: string | null; signOff?: string | null; signature?: string | null },
  today: string
): TemplateValues {
  const [y, m, d] = today.split("-").map(Number);
  const plus = (days: number) => new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  return {
    customerName: "Hannah Brooks",
    title: "Illuminated shopfront sign",
    amount: 2150,
    currency: "USD",
    description: "Design, fabrication and installation of a 2.4m LED-lit fascia sign.",
    validUntil: plus(30),
    quoteDate: today,
    ownerName: business.ownerName,
    businessName: business.name || "Your business",
    signOff: business.signOff,
    signature: business.signature,
  };
}

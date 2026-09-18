import type {
  FollowUpStatus,
  LeadStatus,
  MessageType,
  QuoteStatus,
  Tone,
} from "./constants";

/**
 * What a button-style server action reports back, so a failure can be shown
 * next to the button instead of replacing the page with the error screen.
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

// Row shapes that mirror the Supabase schema (see supabase/schema.sql).

export interface Business {
  id: string;
  user_id: string;
  business_name: string;
  industry: string;
  currency: string;
  owner_name: string;
  phone: string | null;
  email: string | null;
  default_follow_up_days: number[];
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  user_id: string;
  customer_name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  notes: string | null;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
}

export interface Quote {
  id: string;
  user_id: string;
  lead_id: string;
  title: string;
  description: string | null;
  amount: number;
  currency: string;
  quote_date: string; // date (YYYY-MM-DD)
  valid_until: string | null;
  status: QuoteStatus;
  follow_up_count: number;
  last_follow_up_at: string | null;
  next_follow_up_at: string | null;
  notes: string | null;
  /** How a quote the user sent themselves went out. Metadata, never in notes. */
  sent_method: string | null;
  created_at: string;
  updated_at: string;
}

export interface FollowUp {
  id: string;
  user_id: string;
  quote_id: string;
  lead_id: string;
  due_date: string; // date (YYYY-MM-DD)
  status: FollowUpStatus;
  follow_up_number: number;
  message_snapshot: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  user_id: string;
  quote_id: string;
  lead_id: string | null;
  message_type: MessageType;
  tone: Tone;
  content: string;
  created_at: string;
}

/** A follow-up email sent (or attempted) from QuoteLoop — see email_logs. */
export interface EmailLogEntry {
  id: string;
  /** Null once the quote it belonged to was deleted; the record itself stays. */
  quote_id: string | null;
  follow_up_id: string | null;
  recipient_email: string;
  subject: string;
  /** Exact text sent, including the short footer. */
  body: string;
  /** 'pending': still in flight, or the provider never confirmed it. */
  status: "pending" | "sent" | "failed";
  created_at: string;
  sent_at: string | null;
}

// Convenience joined shapes used by list views.
export type QuoteWithLead = Quote & { lead: Pick<Lead, "id" | "customer_name" | "company_name" | "email"> | null };
export type FollowUpWithContext = FollowUp & {
  quote: Pick<
    Quote,
    | "id"
    | "title"
    | "amount"
    | "currency"
    | "status"
    | "follow_up_count"
    | "valid_until"
    | "next_follow_up_at"
  > | null;
  lead: Pick<Lead, "id" | "customer_name" | "company_name" | "email"> | null;
};

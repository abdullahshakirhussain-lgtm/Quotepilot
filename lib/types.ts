import type {
  FollowUpStatus,
  LeadStatus,
  MessageType,
  QuoteStatus,
  Tone,
} from "./constants";

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

// Convenience joined shapes used by list views.
export type QuoteWithLead = Quote & { lead: Pick<Lead, "id" | "customer_name" | "company_name"> | null };
export type FollowUpWithContext = FollowUp & {
  quote: Pick<Quote, "id" | "title" | "amount" | "currency" | "status"> | null;
  lead: Pick<Lead, "id" | "customer_name" | "company_name"> | null;
};

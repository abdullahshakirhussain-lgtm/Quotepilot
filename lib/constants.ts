// ---------------------------------------------------------------------------
// Central place for enums, labels and colors used across the app.
// Stored values mirror the SQL CHECK constraints; labels are what people see.
// ---------------------------------------------------------------------------

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "quote_sent",
  "follow_up_due",
  "negotiating",
  "won",
  "lost",
  "cold",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const QUOTE_STATUSES = [
  "draft",
  "sent",
  "follow_up_due",
  "negotiating",
  "accepted",
  "rejected",
  "expired",
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const FOLLOW_UP_STATUSES = ["pending", "completed", "skipped"] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export const MESSAGE_TYPES = [
  "first_follow_up",
  "second_follow_up",
  "final_follow_up",
  "quote_expiring",
  "objection_response",
  "lost_lead_recovery",
  "thank_you_after_acceptance",
] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const TONES = [
  "friendly",
  "professional",
  "casual",
  "direct",
  "warm",
] as const;
export type Tone = (typeof TONES)[number];

// Types of small service business, A to Z so a name is easy to find, with
// Other last. Includes every trade the landing page speaks to. Stored as plain
// text, so adding one never needs a database change.
export const INDUSTRIES = [
  "AC / HVAC Repair",
  "Cleaning Services",
  "Custom Furniture",
  "Electrical",
  "Freelance / Creative",
  "Garage Door Repair",
  "Home Repair / Handyman",
  "Installation Services",
  "Interior Design",
  "Landscaping",
  "Painting",
  "Pest Control",
  "Photography / Studio",
  "Plumbing",
  "Printing / Signage",
  "Renovation / Remodeling",
  "Roofing",
  "Small Agency",
  "Other",
] as const;

// Selectable business/quote currencies. USD is only the pre-selected option in
// forms; every workspace chooses its own at onboarding.
export const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "NZD",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "INR",
  "LKR",
  "SGD",
  "AED",
  "SAR",
  "ZAR",
  "NGN",
] as const;

/** Cookie carrying the viewer's browser time zone to the server. */
export const TIMEZONE_COOKIE = "qp_tz";

// Follow-up interval presets (in days) offered in Business Settings.
export const FOLLOW_UP_DAY_OPTIONS = [1, 3, 7, 14, 21, 30] as const;
export const DEFAULT_FOLLOW_UP_DAYS = [1, 3, 7, 14];

/** AI drafts per user per rolling 24 hours (cost control). */
export const AI_DAILY_LIMIT = 50;

// ---------------------------------------------------------------------------
// Human-readable labels (plain business language; DB values are unchanged)
// ---------------------------------------------------------------------------

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  quote_sent: "Quote sent",
  follow_up_due: "Follow-up due",
  negotiating: "Negotiating",
  won: "Won",
  lost: "Lost",
  cold: "Cold",
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  follow_up_due: "Follow-up due",
  negotiating: "Negotiating",
  accepted: "Won",
  rejected: "Lost",
  expired: "Expired",
};

export const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  pending: "Pending",
  completed: "Followed up",
  skipped: "Skipped",
};

export const MESSAGE_TYPE_LABELS: Record<MessageType, string> = {
  first_follow_up: "First follow-up",
  second_follow_up: "Second follow-up",
  final_follow_up: "Final follow-up",
  quote_expiring: "Quote expiring",
  objection_response: "Answer an objection",
  lost_lead_recovery: "Win back a lost quote",
  thank_you_after_acceptance: "Thank you (won)",
};

export const TONE_LABELS: Record<Tone, string> = {
  friendly: "Friendly",
  professional: "Professional",
  casual: "Casual",
  direct: "Direct",
  warm: "Warm",
};

// ---------------------------------------------------------------------------
// Status chips, filled pills: blue while a quote is in play, amber when it
// hasn't been sent or a follow-up is due, green for won, grey for lost or idle.
// ---------------------------------------------------------------------------

const NEUTRAL = "bg-stone-100 text-stone-700";
const NOT_SENT = "bg-due-50 text-due-800";
const ACTIVE = "bg-info-50 text-info-700";
const ATTENTION = "bg-due-50 text-due-800";
const WON = "bg-emerald-50 text-emerald-700";
const LOST = "bg-stone-100 text-stone-600";
const MUTED = "bg-stone-100 text-stone-500";

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: NEUTRAL,
  contacted: NEUTRAL,
  quote_sent: ACTIVE,
  follow_up_due: ATTENTION,
  negotiating: ACTIVE,
  won: WON,
  lost: LOST,
  cold: MUTED,
};

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: NOT_SENT,
  sent: ACTIVE,
  follow_up_due: ACTIVE,
  negotiating: ACTIVE,
  accepted: WON,
  rejected: LOST,
  expired: MUTED,
};

export const FOLLOW_UP_STATUS_COLORS: Record<FollowUpStatus, string> = {
  pending: ATTENTION,
  completed: WON,
  skipped: MUTED,
};

// Pipeline columns (lead statuses grouped for the board view).
export const PIPELINE_COLUMNS: LeadStatus[] = [
  "new",
  "contacted",
  "quote_sent",
  "follow_up_due",
  "negotiating",
  "won",
  "lost",
];

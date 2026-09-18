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

// Industries geared at generic small service businesses.
export const INDUSTRIES = [
  "Home Repair / Handyman",
  "Electrical",
  "Plumbing",
  "AC / HVAC Repair",
  "Cleaning Services",
  "Printing / Signage",
  "Interior Design",
  "Custom Furniture",
  "Landscaping",
  "Painting",
  "Freelance / Creative",
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
// Status pill colors. Orange = needs attention, green = won money,
// red = lost. Everything else stays neutral.
// ---------------------------------------------------------------------------

const NEUTRAL = "bg-stone-100 text-stone-600 ring-1 ring-inset ring-stone-200";
const ACTIVE = "bg-white text-stone-800 ring-1 ring-inset ring-stone-300";
const ATTENTION = "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200";
const TALKING = "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200";
const WON = "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200";
const LOST = "bg-red-50 text-red-800 ring-1 ring-inset ring-red-200";
const MUTED = "bg-stone-100 text-stone-400 ring-1 ring-inset ring-stone-200";

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: NEUTRAL,
  contacted: NEUTRAL,
  quote_sent: ACTIVE,
  follow_up_due: ATTENTION,
  negotiating: TALKING,
  won: WON,
  lost: LOST,
  cold: MUTED,
};

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: NEUTRAL,
  sent: ACTIVE,
  follow_up_due: ATTENTION,
  negotiating: TALKING,
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

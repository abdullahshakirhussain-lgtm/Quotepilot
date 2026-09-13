// ---------------------------------------------------------------------------
// Central place for enums, labels and colors used across the app.
// Keeping these in one file keeps the UI, validation and DB constraints aligned.
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
// Human-readable labels
// ---------------------------------------------------------------------------

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  quote_sent: "Quote Sent",
  follow_up_due: "Follow-Up Due",
  negotiating: "Negotiating",
  won: "Won",
  lost: "Lost",
  cold: "Cold",
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  follow_up_due: "Follow-Up Due",
  negotiating: "Negotiating",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
};

export const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  pending: "Pending",
  completed: "Completed",
  skipped: "Skipped",
};

export const MESSAGE_TYPE_LABELS: Record<MessageType, string> = {
  first_follow_up: "First follow-up",
  second_follow_up: "Second follow-up",
  final_follow_up: "Final follow-up",
  quote_expiring: "Quote expiring",
  objection_response: "Objection response",
  lost_lead_recovery: "Lost-lead recovery",
  thank_you_after_acceptance: "Thank you (accepted)",
};

export const TONE_LABELS: Record<Tone, string> = {
  friendly: "Friendly",
  professional: "Professional",
  casual: "Casual",
  direct: "Direct",
  warm: "Warm",
};

// ---------------------------------------------------------------------------
// Tailwind color classes for status badges
// ---------------------------------------------------------------------------

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: "bg-slate-100 text-slate-700",
  contacted: "bg-blue-100 text-blue-700",
  quote_sent: "bg-indigo-100 text-indigo-700",
  follow_up_due: "bg-amber-100 text-amber-800",
  negotiating: "bg-purple-100 text-purple-700",
  won: "bg-emerald-100 text-emerald-700",
  lost: "bg-red-100 text-red-700",
  cold: "bg-slate-100 text-slate-500",
};

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-700",
  follow_up_due: "bg-amber-100 text-amber-800",
  negotiating: "bg-purple-100 text-purple-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-slate-100 text-slate-500",
};

export const FOLLOW_UP_STATUS_COLORS: Record<FollowUpStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-700",
  skipped: "bg-slate-100 text-slate-500",
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

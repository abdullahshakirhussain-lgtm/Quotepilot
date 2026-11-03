// ---------------------------------------------------------------------------
// QuoteLoop's ready-made templates. They live here, not in each account: a user
// who edits one saves their own copy (message_templates.builtin_key), and
// "Restore original" deletes that copy. Unedited ones pick up any improvement
// made here. Follow-up keys are the AI writer's message types, so each
// reminder step has exactly one template.
// ---------------------------------------------------------------------------
import type { MessageType } from "./constants";
import type { TemplateKind } from "./templates";

export interface BuiltinTemplate {
  key: string;
  kind: TemplateKind;
  name: string;
  /** For follow-ups: the step it is written for. */
  messageType: MessageType | null;
  subject: string;
  body: string;
}

const lines = (...l: string[]) => l.join("\n");
const SIGN = ["", "[Sign-off]", "[Signature]"];

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    key: "quote_standard",
    kind: "quote_email",
    name: "Standard quote email",
    messageType: null,
    subject: "Quote from [Business name]: [Job]",
    body: lines(
      "Hi [First name],",
      "",
      "Thanks for asking us about [Job]. Here's our quote:",
      "",
      "[Job]: [Price]",
      "",
      "[Details]",
      "",
      "This quote is valid until [Valid until].",
      "",
      "Just reply to this email if you'd like to go ahead, or if you have any questions.",
      ...SIGN
    ),
  },
  {
    key: "quote_short",
    kind: "quote_email",
    name: "Short quote email",
    messageType: null,
    subject: "Your quote: [Job]",
    body: lines(
      "Hi [First name],",
      "",
      "Here's the price for [Job]: [Price].",
      "",
      "Reply to this email to go ahead.",
      ...SIGN
    ),
  },
  {
    key: "quote_detailed",
    kind: "quote_email",
    name: "Detailed quote email",
    messageType: null,
    subject: "Quote from [Business name]: [Job]",
    body: lines(
      "Hi [First name],",
      "",
      "Thanks for the chance to quote on [Job]. Here are the details.",
      "",
      "Price: [Price]",
      "",
      "What's included: [Details]",
      "",
      "This price is valid until [Valid until].",
      "",
      "If you'd like to go ahead, reply to this email and we'll arrange the next steps with you. If anything is unclear, or you'd like to change the scope, just let us know.",
      ...SIGN
    ),
  },
  {
    key: "first_follow_up",
    kind: "follow_up",
    name: "First check-in",
    messageType: "first_follow_up",
    subject: "Following up on your quote: [Job]",
    body: lines(
      "Hi [First name],",
      "",
      "Just checking you received our quote for [Job] ([Price]). Happy to answer any questions or walk you through the details whenever suits you.",
      ...SIGN
    ),
  },
  {
    key: "second_follow_up",
    kind: "follow_up",
    name: "Second follow-up",
    messageType: "second_follow_up",
    subject: "Following up on your quote: [Job]",
    body: lines(
      "Hi [First name],",
      "",
      "Following up on the quote for [Job] ([Price]). We'd love to help with this. Is there anything you'd like clarified before moving forward?",
      ...SIGN
    ),
  },
  {
    key: "final_follow_up",
    kind: "follow_up",
    name: "Last check-in",
    messageType: "final_follow_up",
    subject: "Your quote for [Job]",
    body: lines(
      "Hi [First name],",
      "",
      "I don't want to crowd your inbox, so this is my last check-in on the quote for [Job] ([Price]) for now. If the timing isn't right, no problem at all. Just let me know and I'll leave it with you.",
      ...SIGN
    ),
  },
  {
    key: "quote_expiring",
    kind: "follow_up",
    name: "Quote expiring",
    messageType: "quote_expiring",
    subject: "Your quote for [Job] is valid until [Valid until]",
    body: lines(
      "Hi [First name],",
      "",
      "A quick heads-up that our quote for [Job] ([Price]) is valid until [Valid until]. If you'd like to go ahead at this price, just reply and we'll get it booked in.",
      ...SIGN
    ),
  },
  {
    key: "objection_response",
    kind: "follow_up",
    name: "Price concern",
    messageType: "objection_response",
    subject: "About your quote for [Job]",
    body: lines(
      "Hi [First name],",
      "",
      "Thanks for telling me your thoughts on the quote for [Job]. I'd be glad to talk it through. We can look at options or adjust the scope so it fits what you need.",
      ...SIGN
    ),
  },
  {
    key: "lost_lead_recovery",
    kind: "follow_up",
    name: "Win back",
    messageType: "lost_lead_recovery",
    subject: "Checking in about [Job]",
    body: lines(
      "Hi [First name],",
      "",
      "It's been a little while since we sent the quote for [Job]. No pressure at all. I just wanted to check whether the timing is better now, or if your plans have changed. Always glad to help.",
      ...SIGN
    ),
  },
  {
    key: "thank_you_after_acceptance",
    kind: "follow_up",
    name: "Thank you",
    messageType: "thank_you_after_acceptance",
    subject: "Thank you: [Job]",
    body: lines(
      "Hi [First name],",
      "",
      "Thank you for going ahead with [Job]. We really appreciate it. I'll be in touch shortly with the next steps so we can get started.",
      ...SIGN
    ),
  },
];

export const STANDARD_QUOTE_KEY = "quote_standard";

export function builtinByKey(key: string | null | undefined): BuiltinTemplate | undefined {
  return key ? BUILTIN_TEMPLATES.find((t) => t.key === key) : undefined;
}

// Facts the public pages repeat: price, trial, contact, limits, and the trade
// pages. Kept in one place so the landing page, trade pages, structured data
// and FAQ never disagree.

import { EMAIL_DAILY_LIMIT, EMAIL_MONTHLY_LIMIT } from "@/lib/email";
import { AI_DAILY_LIMIT, DEFAULT_FOLLOW_UP_DAYS } from "@/lib/constants";

export const SITE_URL = "https://quoteloop.site";
export const CONTACT_EMAIL = "hello@quoteloop.site";
export const FOUNDER = "Abdullah Shakir Hussain";

export const TRIAL_DAYS = 14;
export const PRICE_MONTHLY = 24.99;
export const PRICE_LABEL = "$24.99";
export const PRICE_LINE = `Free for ${TRIAL_DAYS} days, then ${PRICE_LABEL} a month.`;

export const LIMITS = {
  emailsPerMonth: EMAIL_MONTHLY_LIMIT,
  emailsPerDay: EMAIL_DAILY_LIMIT,
  aiDraftsPerDay: AI_DAILY_LIMIT,
  defaultFollowUpDays: DEFAULT_FOLLOW_UP_DAYS,
};

export const PLAN_INCLUDES = [
  "Unlimited quotes and customers",
  "Follow-up reminders on the schedule you choose",
  `AI follow-up drafts (up to ${AI_DAILY_LIMIT} a day)`,
  `Send up to ${EMAIL_MONTHLY_LIMIT} emails a month from QuoteLoop`,
  "Copy any message to WhatsApp, text or your own email",
  "Won/lost tracking, pipeline and customer list",
  "Works on your phone, no app to install",
  "Export everything to CSV, any time",
];

export type Trade = {
  slug: string;
  /** "roofers", as in "quote follow-up for roofers". */
  plural: string;
  /** The industry name the lead finder and the app use. */
  industry: string;
  intro: string;
  /** Why quotes go cold in this trade. */
  reasons: string[];
  example: { customer: string; job: string; amount: string; followUp: string };
};

export const TRADES: Trade[] = [
  {
    slug: "roofers",
    plural: "roofers",
    industry: "Roofing",
    intro:
      "A roof quote is a big decision for a homeowner. Many get two or three quotes, then wait for the insurance adjuster, a partner or the next storm. The roofer who checks in at the right time is often the one who gets the job.",
    reasons: [
      "Homeowners collect several quotes and compare them for weeks",
      "Insurance claims and adjuster visits put decisions on hold",
      "Busy season means you're on a roof, not chasing paperwork",
    ],
    example: {
      customer: "Daniel",
      job: "Roof leak repair and flashing",
      amount: "$1,450",
      followUp:
        "Hi Daniel, just checking in on the roof repair quote from last week. If the adjuster has been out, I'm happy to look at their report with you. We can usually start within a few days of your go-ahead.",
    },
  },
  {
    slug: "hvac",
    plural: "HVAC and AC companies",
    industry: "HVAC",
    intro:
      "Replacement quotes for AC units and furnaces are expensive, so customers think them over. When the weather turns, they call whoever is top of mind. A short, well-timed follow-up keeps that someone you.",
    reasons: [
      "System replacements are big purchases that get put off",
      "Customers wait for the next heatwave or cold snap to decide",
      "Your techs are in the field, not following up on estimates",
    ],
    example: {
      customer: "Marcus",
      job: "AC service, 3 units",
      amount: "$640",
      followUp:
        "Hi Marcus, just checking you received our quote for servicing your three AC units. Happy to line up a weekend slot if that's easier before the hot weather arrives.",
    },
  },
  {
    slug: "plumbers",
    plural: "plumbers",
    industry: "Plumbing",
    intro:
      "Emergency jobs book themselves. Planned work like water heater replacements, repipes and bathroom updates does not: the customer has time to shop around, and a quick follow-up often decides who gets the call.",
    reasons: [
      "Planned work gets compared against other plumbers' prices",
      "Customers delay non-urgent work until it becomes urgent",
      "Quotes go out between call-outs and are easy to forget",
    ],
    example: {
      customer: "Tom",
      job: "Water heater replacement",
      amount: "$1,900",
      followUp:
        "Hi Tom, following up on the water heater quote. If the price is the sticking point, I can walk you through the tank and tankless options. We have a slot open next week.",
    },
  },
  {
    slug: "electricians",
    plural: "electricians",
    industry: "Electrical",
    intro:
      "Panel upgrades, EV chargers and rewiring jobs are quoted, then left waiting while the customer checks budgets or other electricians. Following up keeps your quote in front of them while they decide.",
    reasons: [
      "Bigger jobs like panel upgrades take time to approve",
      "Customers compare several electricians' quotes",
      "Small jobs and call-outs crowd out follow-ups on big ones",
    ],
    example: {
      customer: "Priya",
      job: "EV charger installation",
      amount: "$1,250",
      followUp:
        "Hi Priya, just checking in on the EV charger quote. If you're still deciding on the charger model, I'm happy to recommend one that suits your panel.",
    },
  },
  {
    slug: "cleaning-businesses",
    plural: "cleaning businesses",
    industry: "Cleaning",
    intro:
      "Recurring cleaning contracts are worth far more than the first clean. Offices and homeowners often ask for quotes from a few companies, and the one that follows up politely tends to win the regular work.",
    reasons: [
      "Office managers collect quotes and decide weeks later",
      "A recurring contract is worth many times the first visit",
      "Quotes go out by text or email and get buried",
    ],
    example: {
      customer: "Hannah",
      job: "Office deep clean, monthly",
      amount: "$1,850",
      followUp:
        "Hi Hannah, following up on the monthly office cleaning quote. If it helps, we can start with a single deep clean so you can see the standard before committing.",
    },
  },
  {
    slug: "landscapers",
    plural: "landscapers and lawn care companies",
    industry: "Landscaping",
    intro:
      "Landscaping quotes are seasonal: the customer wants it done before spring or before an event, but waits on budget or a partner's say. A follow-up at the right time turns a 'maybe later' into a booked job.",
    reasons: [
      "Design and install work is a considered, seasonal purchase",
      "Customers wait for budget or another quote",
      "Spring rush leaves no time to chase older quotes",
    ],
    example: {
      customer: "Sofia",
      job: "Backyard planting and irrigation",
      amount: "$3,400",
      followUp:
        "Hi Sofia, just checking in on the backyard planting quote. Spring slots are starting to fill, so let me know if you'd like me to hold a start date for you.",
    },
  },
  {
    slug: "painters",
    plural: "painting contractors",
    industry: "Painting",
    intro:
      "Painting quotes are easy to compare, so customers do. Interior and exterior jobs often get three quotes, and many painters never follow up. A friendly check-in sets you apart before the decision is made.",
    reasons: [
      "Customers compare several painting quotes side by side",
      "Exterior jobs wait on the weather",
      "You're on the job all day, not at your inbox",
    ],
    example: {
      customer: "Priya",
      job: "Kitchen and hallway repaint",
      amount: "$3,200",
      followUp:
        "Hi Priya, following up on the kitchen and hallway repaint. If you're still choosing colours, I'm happy to bring samples by. We have a crew free the week after next.",
    },
  },
  {
    slug: "pest-control",
    plural: "pest control companies",
    industry: "Pest Control",
    intro:
      "Customers call when they see a problem, get a quote, and sometimes go quiet once the immediate panic fades. A timely follow-up brings them back before the problem does, and turns one treatment into an ongoing plan.",
    reasons: [
      "Urgency fades once the first pest is gone",
      "Ongoing plans need a second conversation",
      "Customers compare national brands with local companies",
    ],
    example: {
      customer: "Ben",
      job: "Termite inspection and treatment",
      amount: "$850",
      followUp:
        "Hi Ben, just checking in on the termite treatment quote. If you'd like, we can start with the inspection this week so you know exactly what you're dealing with.",
    },
  },
  {
    slug: "garage-door-companies",
    plural: "garage door companies",
    industry: "Garage Doors",
    intro:
      "Repairs get booked on the spot, but new doors and openers are quoted and considered. Homeowners compare styles and prices, and the company that follows up with a helpful note is usually the one they call back.",
    reasons: [
      "New doors and openers are compared on style and price",
      "Homeowners put replacements off until the old door fails",
      "Quotes made on the driveway are easy to lose track of",
    ],
    example: {
      customer: "Grace",
      job: "Insulated garage door and opener",
      amount: "$2,100",
      followUp:
        "Hi Grace, following up on the garage door and opener quote. If you'd like to see the colour options in person, I can drop off a brochure, or send photos of recent installs.",
    },
  },
];

export const tradeBySlug = (slug: string) => TRADES.find((trade) => trade.slug === slug);

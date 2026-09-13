// ---------------------------------------------------------------------------
// Demo data (generic small service businesses only). Pure: it only builds the
// records. Each quote's follow-up counters are DERIVED from its reminder rows
// with the same function the app uses, so the seed can't drift out of sync.
// ---------------------------------------------------------------------------
import { addDays, formatCurrency } from "./utils";
import { deriveQuoteFollowUpState, dueDateToTimestamp } from "./follow-up-state";

export interface SeedLead {
  customer_name: string;
  company_name: string | null;
  phone: string;
  email: string;
  source: string;
  notes: string;
  status: string;
}

export interface SeedQuote {
  lead: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  quote_date: string;
  valid_until: string | null;
  status: string;
  notes: string;
  follow_up_count: number;
  last_follow_up_at: string | null;
  next_follow_up_at: string | null;
}

export interface SeedFollowUp {
  quoteTitle: string;
  lead: string;
  due_date: string;
  status: "pending" | "completed" | "skipped";
  follow_up_number: number;
  completed_at: string | null;
}

export interface DemoSeed {
  leads: SeedLead[];
  quotes: SeedQuote[];
  followUps: SeedFollowUp[];
  message: {
    quoteTitle: string;
    lead: string;
    message_type: string;
    tone: string;
    content: string;
  };
}

type Reminder = [offsetDays: number, status: SeedFollowUp["status"]];

export function buildDemoSeed(today: string, currency: string, signOff: string): DemoSeed {
  const day = (n: number) => addDays(today, n);

  const leads: SeedLead[] = [
    {
      customer_name: "Marcus Reed",
      company_name: "Reed & Co Offices",
      phone: "+1 555 0142",
      email: "marcus@reedco.example",
      source: "Website form",
      notes: "Needs three split-system AC units serviced before summer.",
      status: "quote_sent",
    },
    {
      customer_name: "Priya Nair",
      company_name: null,
      phone: "+1 555 0199",
      email: "priya.nair@example.com",
      source: "Referral",
      notes: "Living and dining room redesign for a new apartment. Comparing two studios.",
      status: "negotiating",
    },
    {
      customer_name: "Hannah Brooks",
      company_name: "The Corner Bakery",
      phone: "+1 555 0110",
      email: "hannah@cornerbakery.example",
      source: "Walk-in",
      notes: "Owns a local bakery. Wants a new illuminated shopfront sign.",
      status: "follow_up_due",
    },
    {
      customer_name: "Dana Whitfield",
      company_name: null,
      phone: "+1 555 0173",
      email: "dana.w@example.com",
      source: "Google",
      notes: "End-of-lease deep clean for a 2-bed apartment.",
      status: "won",
    },
    {
      customer_name: "Tom Alvarez",
      company_name: null,
      phone: "+1 555 0188",
      email: "tom.alvarez@example.com",
      source: "Instagram",
      notes: "Custom walnut dining table, seats 8.",
      status: "contacted",
    },
    {
      customer_name: "Sofia Martins",
      company_name: "Greenline Property Management",
      phone: "+1 555 0165",
      email: "sofia@greenline.example",
      source: "Referral",
      notes: "Weekly office cleaning for two sites. Went with a cheaper provider.",
      status: "lost",
    },
    {
      customer_name: "Leo Grant",
      company_name: null,
      phone: "+1 555 0121",
      email: "leo.grant@example.com",
      source: "Phone call",
      notes: "Wants a quote to rewire the kitchen and add six downlights. Site visit booked.",
      status: "new",
    },
  ];

  // Base quote facts plus their reminder history ([offset from today, status]).
  const quoteDefs: Array<{
    base: Omit<SeedQuote, "currency" | "follow_up_count" | "last_follow_up_at" | "next_follow_up_at">;
    reminders: Reminder[];
  }> = [
    {
      base: {
        lead: "Marcus Reed",
        title: "Servicing of 3 split-system AC units",
        description:
          "Full service and gas top-up for three office AC units, including filter replacement and a 6-month check-up.",
        amount: 780,
        quote_date: day(-6),
        valid_until: day(8),
        status: "sent",
        notes: "Sent PDF quote by email. Marcus asked about weekend availability.",
      },
      reminders: [[-2, "completed"], [0, "pending"], [4, "pending"]],
    },
    {
      base: {
        lead: "Priya Nair",
        title: "Living + dining room redesign",
        description:
          "Concept, mood boards, furniture sourcing and styling for living and dining areas.",
        amount: 5400,
        quote_date: day(-12),
        valid_until: day(18),
        status: "negotiating",
        notes: "Client wants to phase the work across two payments.",
      },
      reminders: [[-6, "completed"], [-3, "completed"], [1, "pending"]],
    },
    {
      base: {
        lead: "Hannah Brooks",
        title: "Illuminated shopfront sign",
        description: "Design, fabrication and installation of a 2.4m LED-lit fascia sign.",
        amount: 2150,
        quote_date: day(-9),
        valid_until: day(-1),
        status: "follow_up_due",
        notes: "Quote validity just lapsed, so this is a good candidate for an expiry nudge.",
      },
      reminders: [[-4, "completed"], [-1, "pending"]],
    },
    {
      base: {
        lead: "Dana Whitfield",
        title: "End-of-lease deep clean (2-bed)",
        description: "Full deep clean including kitchen, bathrooms, windows and carpet steam.",
        amount: 320,
        quote_date: day(-20),
        valid_until: day(-6),
        status: "accepted",
        notes: "Booked and completed. Great review left on Google.",
      },
      reminders: [[-16, "completed"]],
    },
    {
      base: {
        lead: "Tom Alvarez",
        title: "Custom walnut dining table (seats 8)",
        description: "Solid walnut table, 2.2m, hand-finished, delivered and set up.",
        amount: 3200,
        quote_date: day(-2),
        valid_until: day(28),
        status: "draft",
        notes: "Still finalising timber choice before sending.",
      },
      reminders: [],
    },
    {
      base: {
        lead: "Sofia Martins",
        title: "Weekly office cleaning contract (12 months)",
        description: "Weekly cleaning of two office sites, including consumables and a monthly deep clean.",
        amount: 4800,
        quote_date: day(-25),
        valid_until: day(-10),
        status: "rejected",
        notes: "Lost on price. Worth a recovery message next quarter.",
      },
      // Third reminder was skipped automatically when the quote was marked lost.
      reminders: [[-22, "completed"], [-18, "completed"], [-11, "skipped"]],
    },
  ];

  const followUps: SeedFollowUp[] = [];
  const quotes: SeedQuote[] = quoteDefs.map(({ base, reminders }) => {
    const rows: SeedFollowUp[] = reminders.map(([offset, status], i) => ({
      quoteTitle: base.title,
      lead: base.lead,
      due_date: day(offset),
      status,
      follow_up_number: i + 1,
      completed_at: status === "completed" ? dueDateToTimestamp(day(offset)) : null,
    }));
    followUps.push(...rows);
    return { ...base, currency, ...deriveQuoteFollowUpState(rows) };
  });

  const message = {
    quoteTitle: "Servicing of 3 split-system AC units",
    lead: "Marcus Reed",
    message_type: "first_follow_up",
    tone: "friendly",
    content:
      `Hi Marcus,\n\nJust checking you received our quote for servicing your three AC units ` +
      `(${formatCurrency(780, currency)}). Happy to answer any questions or line up a weekend ` +
      `slot if that's easier.\n\nBest,\n${signOff}`,
  };

  return { leads, quotes, followUps, message };
}

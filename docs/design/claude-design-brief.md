# QuoteLoop interface makeover: design brief

Paste this whole document into Claude Design. It is the binding spec for a full visual and
interaction makeover of QuoteLoop. Read all of it before designing anything.

---

## 0. How to work with this brief

1. **This is a makeover, not a new product.** Every screen, button, field and message you
   design must map to something listed in section 7 (screens) or section 8 (messages). Do not
   add features, pages, navigation items, charts, widgets, settings, avatars, notification
   bells, search bars, onboarding tours, testimonials, logos, statistics or decorative
   sections. If you believe something is missing, write it in a "Questions" list at the end
   instead of designing it.
2. **Work in this order and stop for review after step 2:**
   1. Read sections 1 to 6.
   2. Propose **three distinct design directions** (section 5), each with a written plan.
      Review each plan against section 4 and say what you changed and why. Then recommend one.
   3. After a direction is chosen: the design system (section 6), then every screen in
      section 7 in every listed state, desktop (1280px) and phone (390px).
   4. Run the acceptance checklist (section 11) on your own output and fix failures before
      handing over.
3. **Use the real sample data** from section 10. No lorem ipsum, "User Name", "Item 1",
   invented metrics or placeholder images.
4. **Words are part of the design.** Keep the meaning of every existing message. You may
   tighten wording using the rules in section 4.7, but never invent claims, numbers or
   promises.

---

## 1. The product, the people, the job

**QuoteLoop** (https://quoteloop.site) is a quote follow-up tracker for small service
businesses: roofers, HVAC and AC technicians, plumbers, electricians, cleaners,
landscapers, painters, pest control, garage door companies, installers, small studios and
freelancers. Sold worldwide, priced at $24.99 a month after a 14-day free trial (no card for
the trial).

**The problem it solves:** a business sends a price to a customer, the customer goes quiet,
and the job goes to whoever checks in first. QuoteLoop keeps every open quote visible,
reminds the owner when to follow up (by default 1, 3, 7 and 14 days after sending), drafts
the follow-up message with AI, and records whether the job was won or lost.

**Who uses it**
- Owner-operators and office managers of businesses with 1 to 20 people. Practical, busy,
  not designers, often not "tech people". Many speak English as a second language.
- They use it **on a phone** in the van, on a roof, between jobs (quick checks: who do I chase
  today?), and **on a laptop** at the end of the day (adding quotes, writing messages).
- They care about money and time. Every screen should answer "what do I do next?" fast.

**Trust rules the design must express (these are product promises, not style)**
- QuoteLoop **never sends anything automatically.** Every email is reviewed and sent by a
  person clicking Send. AI only drafts.
- Customers receive a plain personal email "from Your Business via QuoteLoop"; replies go to
  the business's own inbox.
- The data belongs to the user: export to CSV at any time; read-only (not deleted) when a
  subscription ends.
- Global product: no country, currency or time zone is assumed. Amounts are shown in each
  quote's own currency; different currencies are never added together.

**Brand facts**
- Name: QuoteLoop. The logo is the **wordmark only** (the name set in type). There is no
  symbol, no "Q" mark, no mascot. Do not create one.
- Operated by one independent developer. No fake team, no fake customers.
- Must never look or sound related to weddings or events.

**Tech context (so the design is buildable):** Next.js App Router, React, Tailwind CSS,
lucide-react icons available, self-hosted Google Fonts via next/font. Design with CSS custom
properties (tokens). Components must work with keyboard and screen readers.

---

## 2. What is wrong today (critique of the current interface)

Screenshots of every current screen were reviewed at 1280px and 390px. The owner's own
words: it "looks and feels like a site from the 1990s" and the payment message "does not go
away". Specific findings:

**Visual identity reads as a default, not a choice**
1. The palette is warm off-white/stone surfaces, a burnt-orange accent (#EA5F22/#D24A12) and
   near-black panels. That combination is one of the named "AI-generated" defaults (cream
   surface with clay/terracotta accent; near-black with a single bright accent).
2. The sample-data banner is pale violet, which adds the other best-known AI tell (purple).
3. One typeface (IBM Plex Sans) at a narrow range of sizes (mostly 13 to 15px). Hierarchy is
   flat; many labels are tracked ALL-CAPS ("WON", "LOST", "WIN RATE", "WAITING IN OPEN
   QUOTES", "HISTORY").

**Template chrome everywhere**
4. Meta strings joined with middle dots on almost every row ("1 overdue · 1 due today",
   "Hannah Brooks · The Corner Bakery", "Quote expiring · Friendly").
5. Arrows appended to link text ("All follow-ups →", "Review follow-ups →", → on modal choices).
6. An em dash in dashboard copy ("— follow up before the customer goes cold").
7. The ✨ sparkles icon on every AI button ("Write follow-up", "Draft", "Nudge customer",
   "Win back", "Say thanks"). Research (NN/g) found no user associates it with AI.
8. Coloured left-border stripes on quote rows (red, orange, grey) used as decoration.
9. Badge soup: up to three tinted pills per row (status, "Sample", "Follow-up due") in
   amber, violet and blue at once.

**Layout and hierarchy**
10. Dashboard is the "dashboard centroid": a near-black hero card with one huge dollar figure,
    then a row of five equal stat boxes with tiny caps labels, then two lists. Low-value
    numbers (e.g. "Won $320.00" in green, "Lost $4,800.00" in red) get the same weight as the
    one thing that matters: who to follow up with now.
11. Stacked banners: on every app page a full-width trial card, then a sample-data card, then
    the page header. On a phone the quote list starts below the first screen.
12. Duplicate primary actions: "New quote" appears in the sidebar and the page header (desktop),
    in the top bar and the page header (phone), three times on the dashboard.
13. Quote rows carry five controls (Write follow-up, View follow-ups, Won, Lost, ⋯). Titles
    truncate ("Illuminated shop…") while space is spent on buttons; status lines wrap mid-phrase
    ("overdue by 1 / day"). On a phone the buttons wrap into a second block.
14. Settings is a column of identical bordered cards with equal weight. The destructive
    "Delete all data" sits beside harmless sample-data buttons.
15. Pipeline: native browser `<select>` boxes inside each card, truncated stage names
    ("Follow-up du"), the last column clipped at 1280px wide.
16. Plain unstyled "Loading…" text as the loading state; generic centred empty states.

**Interaction**
17. **Native browser pop-ups (`window.confirm`)** for: remove sample data, delete a quote,
    delete a customer, close-without-saving warnings, "Go to Settings?". These grey system
    boxes are a big part of the "1990s" feel and are inconsistent with the one designed
    type-to-confirm dialog (Delete all data).
18. Native `<select>` and date pickers everywhere, unstyled.
19. Success feedback is inconsistent: some green inline boxes, some toasts with Undo, some
    status lines, a payment message that used to stay forever.

**Marketing pages**
20. The landing page follows the cookie-cutter order: centred hero with two buttons and a
    product screenshot, an icon strip, a four-box stats row, numbered steps 1 to 4, screenshot
    tour, a 9-box icon feature grid, email example, trade chips, pricing card, FAQ, footer.
21. Its product screenshots date from 4 October 2026 and will be stale after this makeover;
    they must be re-captured from the new design (see 7.20).

**Keep (these are good and must survive)**
- Plain, specific copy that says what happens ("Nothing is sent until you choose to").
- Follow-ups grouped Overdue / Due today / Upcoming.
- Undo after marking a quote won or lost.
- Honest marketing: no testimonials, one sourced statistic, a real "who's behind QuoteLoop".
- Type-to-confirm for deleting all data.

---

## 3. Goals for the makeover

1. **Feels like a well-made tool for tradespeople**, not a startup template and not a 1990s
   form. Calm, confident, quick to scan in daylight on a phone.
2. **The next action is always obvious.** One primary action per screen, in one place.
3. **Money and dates are easy to read** (tabular numbers, clear currency, relative and exact
   dates).
4. **Every state is designed**: empty, loading, error, success, read-only, sample data,
   first use, slow network, phone.
5. **Consistent feedback system**: one way to confirm, one way to warn, one way to fail,
   one way to celebrate rare moments (payment, first quote).
6. **Accessible by default**: WCAG 2.2 AA, keyboard and screen reader friendly.

---

## 4. Binding anti-slop rules

These rules come from in-depth research of what people identify as AI-generated ("AI slop")
design and copy: Anthropic's own frontend-design guidance, the "Signs of AI design" field
guide (97 signs), the Impeccable slop catalogue (68 patterns), NN/g research, GOV.UK and
Atlassian design-system content rules, Wikipedia's "Signs of AI writing", and eight design
critiques. Sources are listed in Appendix A. The meta-rule from every source: **one sign
proves nothing; stacked unchosen defaults are the signature. Every choice must be a decision
made for this product, not a default.**

### 4.1 Colour
- No purple, indigo or violet gradients or accents (Tailwind indigo-500 #6366F1, violet-500
  #8B5CF6 and similar). No blue-to-purple anything.
- Do not swap one default for the next. Also avoid: warm cream/beige surface (~#F4F1EA) with
  terracotta/clay accent (~#D97757); near-black (#0B0B0B, #111) with a single neon,
  acid-green or vermilion accent and glow; emerald (#10B981) as the "safe" substitute. The
  current QuoteLoop palette is close to the first two; move away from it.
- No gradient text. No gradient buttons. No glows, halos, radial spotlights, blurred blobs,
  aurora or orb backgrounds, grain overlays, decorative grid lines or stripes.
- One dominant neutral family, **one** action accent, and semantic colours used only for
  state (overdue/danger, warning, success, info). Colour never carries meaning alone (pair
  with text or icon).
- Contrast: body text at least 4.5:1, large text and UI boundaries at least 3:1, against
  the real background. No grey text on coloured backgrounds.

### 4.2 Typography
- Do not default to Inter, Roboto, Arial, Open Sans, Lato, system UI, Geist, Space Grotesk or
  Instrument Serif. Choose type for this subject and say why. One family, or two clearly
  different ones.
- No oversized italic serif headlines; no single accented word in a headline (italic,
  coloured or bold).
- No tracked ALL-CAPS eyebrow labels above headings; no all-caps labels in general (sentence
  case everywhere, including buttons, headings, table headers, badges).
- A real type scale with 6 to 8 sizes and clear steps; body text 16px on phones; tabular
  figures for money, counts and dates; line length 45 to 75 characters for reading text;
  heading levels in order.
- No monospace used as decoration for small data labels.

### 4.3 Layout, surfaces and density
- Not the "SaaS card kit": do not chop every section into identical rounded boxes with the
  same radius and the same soft grey shadow (rgba(0,0,0,.1)). Use spacing, alignment,
  dividers and type for grouping; reserve containers for things that are genuinely objects
  (a quote, a dialog).
- At most 2 to 3 corner radii, chosen by element size. One elevation rule (e.g. only
  floating layers: dialogs, menus, toasts have a shadow). Never a hairline border **and** a
  wide soft shadow on the same element ("ghost card").
- No coloured side stripe on cards unless it is a real alert. No cards inside cards.
  No glassmorphism.
- No identical 3-up or 6-up icon-card grids; no bento grids; no icon in a tinted rounded
  square stacked above a heading.
- No numbered markers (01/02/03) unless the content is a real sequence.
- No meta strings joined with middle dots as a habit ("A · B · C"); no "WORD — fragment"
  labels; no "→" appended to buttons or links.
- One spacing scale (for example 4, 8, 12, 16, 24, 32, 48, 64) and nothing in between.
  Related things close together, more space between groups. Working screens (lists, forms)
  use a standard app density, not landing-page airiness: a phone should show at least 4 to 5
  follow-ups or quotes without scrolling past banners.
- Not everything centred. Left-align reading text and lists.

### 4.4 App and dashboard specifics
- No "dashboard centroid" (sidebar of rounded icon buttons + top bar with search, bell and
  avatar + four stat cards with green/red deltas + one line chart + zebra table). QuoteLoop
  has no charts today; do not add any.
- No hero-metric layout by reflex (huge number, small label, supporting stats). Lead with
  the task (who to follow up with), show money in context.
- No unrequested chrome: no avatar menu, no notification bell, no global search, no
  settings cog in a top bar.

### 4.5 Icons and imagery
- No ✨ sparkles for AI. AI actions are labelled with words ("Write follow-up", "Draft a
  message"). If an icon is used, choose one that means the action (a pen, a message), and
  always with a text label.
- No reuse of the same handful of icons for unrelated ideas (Zap = fast, Shield = secure,
  Sparkles = AI, Check = benefit, ArrowRight on every button). Every icon must match its
  meaning or be removed.
- No emoji as icons. No fake terminal or code windows. No 3D blobs, generic circle-and-block
  illustrations, Corporate Memphis people, generated headshots, or recycled trade clichés
  (hazard tape, hard hats, wrenches, toolboxes, hexagons) as decoration.
- Real product screenshots are the only imagery on marketing pages (re-captured from the new
  design with sample data).

### 4.6 Motion
- Motion only to answer an action: open, close, expand, confirm, show what changed (e.g. a
  quote moving to "Won", an Undo appearing). 150 to 250ms, ease-out, no bounce or elastic
  easing, no overshoot.
- No fade-up on every section, no hover lift on every card, no pulsing dots, no marquees, no
  cursor effects, no blinking cursors, no parallax.
- Respect `prefers-reduced-motion` (instant changes).
- Loading: skeletons that match the real layout for page content; a spinner only inside the
  button that is busy.
- Owner's additions (after the first review), as built: the dashboard greeting types itself in
  once per session after signing in (40ms a letter, a caret only while typing, the full text
  given to screen readers); page content eases in after loading (180ms, a 4px rise, rows
  staggered 30 to 40ms); menus pop in (140ms), dialogs rise (180ms, a 220ms sheet on phones);
  the "due today" highlighter swipes in once (420ms); buttons press to 98%. One easing curve
  everywhere: cubic-bezier(0.2, 0.7, 0.2, 1). Entrance animations leave no style behind once
  they end, so menus are never trapped under later rows.

### 4.7 Words (UI copy and marketing copy)
- No buzzwords: unlock, unleash, empower, seamless, supercharge, streamline, elevate,
  leverage, robust, cutting-edge, world-class, best-in-class, effortless, harness, delve,
  game-changing, revolutionise, "in today's fast-paced world", "all-in-one platform".
- No negation pivots ("It's not just X, it's Y"), no rule-of-three slogans, no aphorism at
  the end of every section, no weightless headlines that could fit any product.
- Em dashes: avoid. Use a full stop, comma or colon.
- Sentence case everywhere. No Title Case Headings.
- Buttons say exactly what happens, with a verb: "Send quote email", "Mark won", "Save
  changes". Never "Submit", "OK", "Yes", "No", "Learn more", "Get started", "Continue" where a
  specific verb exists. The same verb carries through: the "Send" button produces "Sent".
- Errors: what happened + how to fix it, next to the cause, in plain words. No "invalid",
  "illegal", "forbidden", "oops", error codes, "please" or "sorry" (except a total failure).
  Do not blame the user. If the cause is unknown, say so and give a next step.
- Empty states: short title, one sentence of reason + next step, one action.
- Confirmations: name the object and the consequence; buttons describe outcomes
  ("Delete quote", "Keep quote"), never Yes/No; no default "yes".
- No fabricated trust content: no user counts, ratings, testimonials, logo walls or badges.

---

## 5. Design direction: what you must propose

Ground the direction in the subject. Look at the materials and vernacular of this world:
paper quote and estimate pads with carbon copies, job sheets on a clipboard, the whiteboard
of jobs in a workshop, a van's dashboard of receipts, invoices with totals in a ruled
column, the satisfaction of a job ticket marked "Won". Use these for ideas about structure,
type and tone, **not** as literal decoration (no paper textures, torn edges, tape, tools or
hazard stripes).

Propose **three directions that are genuinely different from each other**. For each:
- **Palette:** 4 to 6 named hex values (base neutrals, text, one action accent, the semantic
  colours). Show contrast ratios for text on each surface.
- **Type:** typeface(s) and their roles, the full size scale, weights, line heights; how
  numbers are set (tabular figures).
- **Shape and depth:** radius set (2 to 3 values), border rule, elevation rule.
- **Density:** base spacing unit and how list rows, forms and the phone layout use it.
- **Layout concept:** a short description and ASCII wireframes of the dashboard and the
  quotes list at desktop and phone width; where the primary action lives.
- **Principles:** 3 to 5 sentences on what makes this direction specific to QuoteLoop.
- **Where the boldness goes:** pick one memorable element; keep everything else quiet.

Then for each direction answer honestly: "Would I produce this for any similar SaaS?" If any
part is a default from section 4, revise it and state what changed. Recommend one direction
with reasons. **Stop here for review.**

Light theme is the required deliverable. A dark theme is out of scope.

---

## 6. Design system to deliver (after a direction is chosen)

Deliver tokens as CSS custom properties with semantic names (e.g. `--color-action`,
`--color-text-muted`, `--color-danger`, `--space-3`, `--radius-control`), plus a component
sheet showing every component in every state (default, hover, focus-visible, active,
disabled, loading, error).

**Components (all exist today in some form; restyle and unify them)**
- **Buttons:** primary (the single main action), secondary, quiet/ghost, danger; sizes for
  desktop and 44px-minimum phone targets; loading state with spinner inside the button and
  the label kept; icon + label; icon-only only with an accessible name and tooltip.
- **Text input, email input, phone input, amount input** (accepts "1,250.00", shows the
  saved value), **textarea**, **date input**, **select** (styled, not the bare native box),
  **checkbox chips** (follow-up days: Day 1, 3, 7, 14, 21, 30), **segmented control**
  (New customer / Existing customer), **search field**, **field label, hint text, inline
  error, required/optional convention** (pick one: mark optional fields, not both).
- **Status badges** with a fixed mapping (one badge per item; no second "decoration" pill):
  - Quote: Draft, Sent, Follow-up due, Negotiating, Won, Lost, Expired.
  - Customer stage: New, Contacted, Quote sent, Follow-up due, Negotiating, Won, Lost, Cold.
  - Follow-up: Pending, Followed up, Skipped.
  - A "Sample" marker for made-up demo records that is quieter than a status badge.
- **Tabs with counts** (Quotes: Open, Not sent, Won, Lost, All).
- **Overflow menu (⋯)** with items, a section label ("Status"), dividers, and a destructive
  item; keyboard navigable.
- **Dialog** (modal): title, optional description, close button, body, footer actions;
  phone layout as a full-height sheet; unsaved-changes guard designed in (see 8.5).
- **Confirmation dialog** (replaces every `window.confirm`), including the type-to-confirm
  variant (Delete all data: type DELETE).
- **Toast / snackbar** for brief success with optional action (Undo) and dismiss; never the
  only place critical information appears; not auto-dismissed if it holds Undo until a
  reasonable time (8 to 10 s) and pauses on hover/focus.
- **Inline message** (info, warning, error, success) inside forms and dialogs.
- **Page banner** for account-level states (trial ending, payment failed, read-only, sample
  data) with the priority rules in 7.0.
- **Empty state** (first use, cleared/finished, no search results; three variants).
- **Skeleton loaders** for lists, dashboard and settings; a full-page "Something went wrong"
  error with Try again.
- **Copy button** with copied state and manual-copy fallback.
- **Read-only notice** (shown inside create/send dialogs when the account is read-only).
- **Payment confirmation dialog** and **payment pending** state (7.14).
- **App shell:** desktop sidebar, phone top bar + bottom tab bar.

---

## 7. Screen-by-screen map

Every element listed must exist in your design. Exact current labels are in quotes; you may
improve wording under 4.7 but keep the meaning. Each screen needs: desktop 1280px and phone
390px, and every listed state.

### 7.0 App shell (all signed-in pages)

Current structure, keep the information, redesign the form:
- **Desktop sidebar:** wordmark "QuoteLoop"; business name under it (e.g. "Northside Home
  Services"); primary "New quote" button; nav: Dashboard, Quotes, Follow-ups (with a count
  badge of follow-ups needing attention), Pipeline, Customers, Settings; "Sign out" at the
  bottom. Active item clearly marked.
- **Phone:** top bar with wordmark and "New quote"; bottom tab bar: Home, Quotes, Follow-ups
  (badge), Pipeline, Customers, Settings. Must not cover content (content has bottom padding).
- **Primary action placement rule:** "New quote" lives in exactly one place per viewport
  (sidebar on desktop, top bar on phone). Page headers do not repeat it. Empty states may
  offer it once as their single action.
- **Account banners (one at a time, by priority):**
  1. Read-only (trial or subscription ended): "Your account is read-only." + "Your trial or
     subscription has ended: you can view and export everything, but not add, send or draft.
     Subscribe to pick up where you left off." Action: "Subscribe" (goes to Settings,
     Billing).
  2. Payment failed (grace): "Your last payment didn't go through. Update your payment
     details by {date} to keep full access." Action: "Update payment".
  3. Trial ending within 3 days or ended: "Your free trial ends {today/tomorrow/on Nov 16}.
     Subscribe to keep adding quotes and following up." Action: "Subscribe".
  4. Subscription canceled, access continuing: "Your subscription is canceled and ends on
     {date}. Resubscribe any time to keep going."
  5. Plain trial with more than 3 days left: **not a banner.** Show it quietly (e.g. "Free
     trial, 12 days left" in the sidebar and in Settings) so it stops pushing content down.
  6. Sample data present: "You're looking at sample data. These customers are made up, so
     nothing is ever emailed to them." Action: "Remove sample data" (with the designed
     confirmation, 8.5). Compact, dismissible per session, lower priority than 1 to 4.
- **Read-only mode** must be visible wherever a create/send/draft action is attempted: the
  dialog shows the read-only notice "Your QuoteLoop subscription isn't active, so your account
  is read-only for now. Subscribe in Settings to keep adding quotes and following up. Your
  data is safe: you can still view and export it." with "Go to billing".

### 7.1 Dashboard (`/dashboard`)

Purpose: answer "who do I follow up with today, and how much money is waiting?"

States:
- **First use (no quotes):** heading "Welcome to QuoteLoop"; text "Add a quote you've sent, or
  send one from here, and QuoteLoop reminds you when it's time to follow up."; primary "Add
  your first quote"; secondary "Try it with sample data" (loading label "Loading sample
  data…"); note "Not ready yet? Sample data is made up, so you can click around safely and
  remove it any time."
- **Follow-ups need attention:** headline "{n} follow-up(s) need attention" with "{n} overdue"
  and "{n} due today"; support line about following up before the customer goes cold (rewrite
  without the em dash); action "Review follow-ups".
- **All caught up:** "You're all caught up" / "No follow-ups are due today."
- **Money waiting:** "Waiting in open quotes" with the total; "{n} open quotes" and "{total}
  quoted in total". If quotes use more than one currency, each currency is totalled
  separately with the note "Your quotes use more than one currency, so each currency is
  totalled separately."
- **Results:** Won (amount, count), Lost (amount, count), Win rate ("{won} won / {lost} lost";
  "Nothing won or lost yet" when empty), Average quote ("Across quotes sent" or "Per
  currency, across quotes sent"), Quotes sent ("{n} active customers"). Present these as
  secondary information, not five equal boxes.
- **Needs attention list:** each row: customer name, quote title, amount, due status
  ("Overdue · was due yesterday", "Due today", "{n} reminders missed"), follow-up number
  ("follow-up #2"), action "Write follow-up". Link "All follow-ups". Empty: "Nothing due right
  now" / "When a quote's next follow-up comes due, it appears here, ready to write."
- **Coming up list:** customer, quote, "Due tomorrow · follow-up #3", compact action "Draft".
  Empty: "No follow-ups scheduled yet. Add a quote and QuoteLoop schedules them."
- Greeting line exists today ("Good afternoon, Ana · Nov 2, 2026"); keep or drop, but not as a
  tiny caps eyebrow.
- Loading skeleton; error state.

### 7.2 Quotes (`/quotes`)

Header: "Quotes" with summary "{total} waiting on {n} open quotes" (or "Send a quote, or track
one you already sent." when none). Secondary link "View follow-ups".

Controls: tabs **Open, Not sent, Won, Lost, All** with counts; search "Search quotes or
customers".

**Quote item** (one per quote; design both desktop row and phone card):
- Title (must not truncate early; allow two lines on phone), customer name, company,
  amount with currency, status badge, "Sample" marker if demo.
- Status line, by case: "Not sent yet"; "Waiting for customer · follow-up overdue by {n}
  day(s)"; "Waiting for customer · follow up today"; "Waiting for customer"; "Waiting for
  customer · no follow-up scheduled"; sent date; "{n} follow-up(s) sent"; "Next follow-up:
  {date} · tomorrow"; "sent by {method}".
- Actions by state (show at most **one primary + one secondary** visibly; the rest go in ⋯):
  - Draft (not sent): "Send quote email" (or "Add customer email" when the customer has none,
    or "Add business email" when the business has none), "I already sent this" (tooltip
    "Record that you sent this quote yourself").
  - Open and a follow-up is due: "Write follow-up" (primary), "View follow-ups", "Won", "Lost".
  - Open, nothing due: "View follow-ups", "Won", "Lost".
  - Won: "Say thanks". Lost: "Win back". Expired/other closed: "Nudge customer" where offered.
  - ⋯ menu: "Edit quote", "Write early follow-up", label "Status", "Reopen as sent", "Mark
    negotiating", "Mark won", "Mark lost", "Mark expired", divider, "Delete quote"
    (destructive, designed confirmation: "Delete "{title}"? Its follow-ups and messages are
    deleted too. Records of emails QuoteLoop already sent are kept.").
- Inline row error (role alert) when an action fails.

Feedback:
- After Won/Lost: toast "Marked as won: "{title}". It's in the Won tab." with **Undo**; after
  undo "“{title}” is open again, with its reminders back."
- Other toasts: "Follow-up tracking started. Reminders are counted from today.", "Email
  address saved. You can send this quote from QuoteLoop now.", "Quote email sent. Follow-up
  reminders are scheduled.", "Quote saved. QuoteLoop will remind you when to follow up.",
  "Quote saved. This quote already needs a follow-up.", "Quote updated. Its follow-up
  reminders moved with the new sent date."
- Empty: "Add your first quote" / "Send it with QuoteLoop, or track one you already sent.
  Either way, QuoteLoop schedules the follow-ups." / action "New quote". No results: "No quotes
  match your search." Empty tab: "Nothing here right now."
- Disabled-reason hints under send actions (sample quote, already sent, delivery not confirmed,
  email not configured, business email missing, customer email missing): see Appendix B.

### 7.3 New quote dialog (opened from "New quote" anywhere; URL `/quotes?new=1`)

A multi-step dialog. Design every step:
1. **Choose:** title "What are you doing?" (improve), description "Two ways to add a quote."
   Option A "Send a quote with QuoteLoop" ("Create a quote email, send it to the customer, and
   schedule follow-up reminders."; disabled states "Email sending isn't set up for this
   workspace yet." / "Add your business email in Settings before sending from QuoteLoop." with
   "Add business email"). Option B "Track a quote already sent" ("Add a quote you sent
   elsewhere and let QuoteLoop remind you to follow up, counting from the day you sent it.").
   No "→" decoration; make the two choices clearly selectable.
2. **Details form** (both flows):
   - Customer: segmented "New customer" / "Existing customer"; existing = searchable select
     "Choose a customer…" (shows "Name — Company"); new = "Customer name" (e.g. Marcus Reed),
     email ("QuoteLoop sends the quote to this address." in send flow; optional with "Add one
     to email follow-ups from QuoteLoop later." in track flow); duplicate name prompt "You
     already have a customer called {name}. Use them, or keep typing to add a new one." with
     "Use them".
   - Quote: "What did you quote for?" (e.g. Service 3 split-system AC units), Amount
     (AmountInput, "Saved as {value}"), Currency.
   - Track flow: "When did you send it?" (date) with hint "Follow-up reminders are counted from
     this date, so an older quote may already be due." and "How did you send it?" (select:
     "Not sure" + methods).
   - Collapsible "Add more details (optional)": Company, Phone, Description ("Scope of work.
     Helps the AI write a better follow-up."), Valid until (date), Internal notes ("Only you
     see these.").
   - Footer: "Back"; send flow "Preview quote email"; track flow "Start follow-up tracking"
     (duplicate warning turns it into "Add it anyway"); "Track this quote instead" link when
     sending is unavailable.
   - All validation messages in Appendix B.2.
3. **Preview (send flow):** title "Preview quote email", "This is what your customer
   receives." From line "{Business} via QuoteLoop · replies go to {email}", editable Subject and
   body, note "A short line naming your business is added at the end. Nothing is sent until you
   press Send quote email."; stale warning "You changed the quote details after editing this
   email. Check it still matches." with "Rewrite with the new details"; changed-email warning
   "This customer's saved email address is now {email}. Check it before sending."; draft note
   "Your quote is saved as a draft. To change its details, close this and edit it on the
   Quotes page."; actions "Back to details", "Send quote email" (busy "Sending…").
4. **Done:** title "Quote email sent" ("QuoteLoop scheduled your follow-up reminders.") or
   "Follow-up tracking started" ("QuoteLoop will remind you when it is time to follow up." /
   "Reminders were counted from the date you sent it, so this one is already due."). Body:
   "Sent to {email}" or "Saved for {customer}", the follow-up schedule list ("Follow-up #1 …
   {date}"), note when no customer email. Actions: "Write follow-up now" or "Write early
   follow-up", "View follow-ups", "Create another quote".
- Close guard: "Close without saving this quote? What you typed will be lost." / "Close this
  window? Your quote is saved as a draft, but the email text you edited won't be kept."

### 7.4 Edit quote dialog
Title "Edit quote", note "Won, lost and follow-ups are handled from the quote card.". Fields:
Customer (select), "What did you quote for?", Amount, Currency, Sent date (hint "Changing the
sent date moves this quote's upcoming follow-up reminders with it."), Description, Valid until,
Internal notes. Actions "Cancel", "Save changes". Error inline. Close guard "Close without
saving your changes to this quote?".

### 7.5 Send draft quote dialog
Title "Send quote email", description "To {customer}. Reminders start once it's sent.". Same
email preview as 7.3 step 3, plus "Copy" option and "Add business email" when needed. Actions
"Cancel", "Send quote email" ("Sending…"). Close guard "Close without sending? Your changes to
the email won't be kept."

### 7.6 Add customer email dialog
Title "Add customer email", "Save an email address for {customer} so QuoteLoop can send this
quote.", field "Email address" (name@example.com), hint "It is saved to this customer, so
future follow-ups can be emailed too.", actions "Cancel", "Save and continue".

### 7.7 Follow-ups (`/follow-ups`)
Header "Follow-ups", summary "{n} need(s) attention · {n} coming up" (redesign without the
middle dot habit), description "Reminders for every quote you've sent.".
- Optional filter by quote: "Showing reminders for {quote}" + "Show all follow-ups".
- Groups: **Overdue**, **Due today**, **Upcoming**, each with a count; then a collapsible
  "Completed & skipped {n}" ("Showing the latest {n}. Export follow-ups in Settings for the full
  history.").
- **Follow-up item:** customer name, "follow-up #{n}", quote title, amount, Sample marker,
  relative due ("Yesterday", "Due today", "Tomorrow") + exact date, "then {n} more scheduled",
  "One follow-up covers all the missed reminders.", "Add an email address to send from
  QuoteLoop, or copy the message.". Actions: "Write follow-up" (primary when due), "Mark
  followed up" (tooltip "Record that you followed up yourself. Nothing is sent."), ⋯ menu:
  "Remind me tomorrow", "Remind me in 3 days", "Remind me next week", "Remind me in 2 weeks",
  "Skip this reminder" / "Skip these reminders".
- **Completed item:** status badge (Followed up / Skipped), "Final text used:" excerpt,
  actions "View messages", ⋯ "Reopen reminder".
- Notice line with "Dismiss" (e.g. "This follow-up was already completed, maybe in another
  tab.").
- Empty: "No follow-ups due" / "Add a quote and QuoteLoop schedules its follow-ups here, each
  with a ready-to-write message." / "Go to quotes". All done: "You're all caught up. New
  follow-ups appear when you add your next quote."

### 7.8 Follow-up writer dialog (the AI message dialog)
The most important dialog. Title "Follow up with {first name}", description "{quote title} ·
{amount} · {status}" (redesign).
- **Message settings line:** "{Message type} · {Tone}" with "suggested for this quote", and
  "Adjust" / "Hide options" revealing: "Message" select (First follow-up, Second follow-up,
  Final follow-up, Quote expiring, Answer an objection, Win back a lost quote, Thank you (won)),
  "Tone" select (Friendly, Professional, Casual, Direct, Warm), and a context field ("Anything
  to mention? (optional)" or, for objections, "What did the customer say?", placeholder "e.g.
  They said the price is higher than expected").
- **Before drafting:** primary "Draft follow-up for {first name}" with "Written from this
  quote's details. You review it; nothing is sent until you choose to." No sparkles.
- **Drafting:** "Writing a draft…" skeleton of an email.
- **Draft ready:** editable Subject and message (textarea), "Edited" marker when changed, note
  "Review before sending. It's only emailed when you click Send email." (or "...Copy it into
  your own email or phone." when email isn't possible). Actions: "Send email" (busy "Sending…",
  done "Email sent"), "Copy" ("Copied!"), "Mark as followed up" ("Followed up"; tooltip
  "Record that you sent this yourself"), "Rewrite".
- **Why sending is unavailable** (one message, with its fix): email not set up for the
  workspace; "Add your business email in Settings before sending from QuoteLoop." + "Add
  business email"; sample customer ("This is a sample customer from the demo data, so QuoteLoop
  won't email them. Copy the message to try it out."); customer has no email: inline "Add
  {name}'s email to send this from QuoteLoop" field + "Save email" ("Saved to this customer, so
  later follow-ups can be emailed too.") and link "Open Customers".
- **Notices and errors:** AI unavailable/template fallback, daily AI limit ("You've reached the
  limit of {n} AI drafts in 24 hours. You can still write or edit a message yourself."),
  connection failure, delivery not confirmed ("We couldn't confirm whether the email was sent.
  Check the history below before sending it again."), success ("Email sent to {email} and
  follow-up #{n} logged. {next reminder}" / "Logged as follow-up #{n}. …"), "No more reminders
  are scheduled for this quote.".
- **History:** list of past messages with status ("Email sent to {email} · final text used",
  "Logged follow-up #{n} · final text used", "Email to {email} · delivery not confirmed",
  "Email to {email} failed · no follow-up recorded", "Generated draft · {date}"), each with Copy;
  "Show all {n}" / "Show less"; empty "Messages you draft will appear here for reference. When
  you send or log one, the exact text you used is kept." Not an ALL-CAPS "HISTORY" label.
- Close guard: "Close without using your edited message?" (designed dialog).

### 7.9 Customers (`/leads`, labelled "Customers")
Header "Customers", description "Created automatically when you add a quote.", actions "Add
customer" (secondary; "New quote" stays in the shell only).
- Search "Search name, company, email or phone"; filter "All stages" + stages.
- Desktop table: columns Customer (name, company, Sample), Contact (email or "No email yet",
  phone), Source, Stage (badge), actions: "Quote" (new quote for this customer, tooltip "New
  quote for this customer"), Edit (icon with label "Edit customer"), Delete (designed
  confirmation: "Delete {name}? Their quotes and follow-ups are deleted too. Records of emails
  QuoteLoop already sent are kept.").
- Phone cards: same data; actions "Add email" (when missing), "Edit", "New quote", "Delete".
- Empty: "No customers yet" / "Customers are created automatically when you create a quote." /
  "New quote". No results: "No customers match your search." Delete error inline.

### 7.10 Add / edit customer dialog
Title "Add customer" / "Edit customer", description "Quotes and follow-up emails use these
details." (+ "Customers are also added automatically when you add a quote." when adding).
Fields: Customer name (required), Company, Source ("Referral, Google, walk-in…"), Phone, Email,
Status (stage select), Notes ("What do they need? Any context worth remembering."). Duplicate
warning (amber): "You already have a customer with {email/phone}: {name}. If this is a
different customer, press “Add anyway”." Actions "Cancel", "Add customer"/"Save changes"/"Add
anyway"/"Save anyway". Close guard "Close without saving? What you typed will be lost."

### 7.11 Pipeline (`/pipeline`)
Header "Pipeline", "Every customer by stage. Won and Lost update automatically from your
quotes." plus "{n} cold hidden — see Customers" (rewrite without the dash).
- Columns: New, Contacted, Quote sent, Follow-up due, Negotiating, Won, Lost (Cold hidden).
  Each: stage name, count, total amount ("still open" where relevant). Empty column "None".
- Card: customer name, company, amount; a designed control to move stage ("Move {name} to
  another stage"), not a bare native select with truncated text. Error "That didn't go through.
  Refresh the page and try again."
- Desktop: columns must fit or scroll horizontally with visible affordance and no clipped
  content. Phone: stacked by stage (current behaviour) with counts.
- Empty: "Your pipeline is empty" / "Customers appear here as you add quotes, grouped by how far
  along they are." / "New quote".

### 7.12 Settings (`/settings`)
Header "Settings", "Your business details, reminder schedule and data.". Sections with
**different weights** (profile and billing matter most; data tools are utilities; deleting is
a danger zone):
- **Business profile** ("Used to sign AI-drafted follow-ups. The reminder schedule applies to
  quotes you send or track from now on."): Business name (e.g. CoolAir HVAC Services), Your
  name, Type of business (select, "Choose your type of business"), Currency, Phone (optional,
  "Include country code"), Business email ("Needed to send emails from QuoteLoop: your
  customers' replies come here."), Default follow-up schedule (chips Day 1, 3, 7, 14, 21, 30;
  "Once a quote goes out, QuoteLoop schedules follow-ups on these days after it was sent."),
  "Save changes"; success "Settings saved." (shown again after the page reloads when the
  business name changed); errors in Appendix B.
- **Billing** (see 7.14 for all states): plan line "One plan: $24.99 a month after a 14-day
  free trial. No card needed for the trial."; status + detail; action.
- **Export:** "Download your records as CSV. Opens in Excel or Google Sheets." Buttons
  "Quotes", "Follow-ups", "Customers". Error "That export couldn't be created just now, so
  nothing was downloaded. Please try again."
- **Sample data:** "Load made-up sample quotes into an empty workspace to explore. Remove them
  again without touching your own records, or delete everything to start fresh. Your business
  profile is always kept." Buttons "Load sample data", "Remove sample data". Results "Sample data
  loaded. Head to the Dashboard to explore it.", "Sample data removed ({n} sample customers and
  their quotes). Your own records were kept.", errors.
- **Danger zone:** "Delete all data" → type-to-confirm dialog: title "Delete all data?", "This
  can't be undone.", "Every customer, quote, follow-up and message in this workspace is deleted.
  Your business profile stays, and records of emails QuoteLoop already sent are kept as your
  sending history.", field "Type DELETE to confirm", "Cancel", "Delete everything". Result "All
  customers, quotes, follow-ups and messages were deleted. Records of emails QuoteLoop already
  sent were kept."
- **Account:** "Signed in as {email}", "Sign out".
- Footer links: Privacy Policy, Terms of Service, Refund Policy.

### 7.13 Onboarding (`/onboarding`, first sign-in)
"Welcome to QuoteLoop", heading "Tell us about your business", text "Your name and business
sign the follow-ups QuoteLoop drafts. You can change any of this later in Settings." Same
business form as Settings with submit "Create workspace" (current label from the form). Errors
"Your workspace couldn't be created just now. Please try again." Make this feel like a welcome,
not a tax form.

### 7.14 Billing states and the payment journey
Design **all** of these; this is where the old "banner that never goes away" bug lived.

Settings, Billing section states:
| State | Label | Detail | Action |
|---|---|---|---|
| Trial | Free trial | "{n} days left · ends {date}" | "Subscribe" |
| Active | Active | "Renews {date}" (or "Active until {date}" if set by hand; "Your subscription is active." if no date) | "Manage billing" with hint "Opens Paddle, our payment provider. Come back to quoteloop.site/settings when you're done." |
| Canceled, still paid | Canceled | "Access until {date}" | "Manage billing" |
| Payment failed | Payment failed | "Update your payment details by {date} to keep full access." | "Manage billing" |
| Ended | Not active (read-only) | "You can view and export everything. Subscribe to add, send and draft again." | "Subscribe" |
| Free access | Free access | "Your account has free access." | none |
| Unknown | Status unavailable | "Billing details couldn't be loaded just now. Everything keeps working; check back shortly." | none |
| Payments not connected (fallback) | (any) | | "Email us to subscribe" / "Email us about billing" |
Errors: "You already have a subscription. Use Manage billing in Settings instead.", "Checkout
couldn't be started just now. Please try again.", "There's no payment account to manage yet.
Subscribe first.", "Payments couldn't be reached just now. Please try again in a minute, or
email hello@quoteloop.site."

The journey:
1. Settings → "Subscribe" (button shows busy state) → `/pay` page.
2. **Checkout page (`/pay`)**: QuoteLoop wordmark, Paddle's secure checkout opens as an overlay
   on top. States: "Opening secure checkout…" (with spinner), "Complete your payment in the
   checkout window.", "Checkout closed. Nothing was charged unless you finished paying.", "The
   checkout couldn't open. Check your connection or ad blocker, then start again from
   Settings.", no checkout: "There's no checkout to open here. Subscribe from Settings →
   Billing." Link "Back to Settings". Calm, trustworthy, minimal; it must not look broken while
   Paddle loads.
3. Return to Settings → **Payment pending**: "Confirming your payment… this page updates by
   itself." (refreshes every few seconds, up to about a minute) → if slow: "Your payment is
   taking longer than usual to confirm. It will show here once it does, usually within a few
   minutes. If it hasn't after an hour, email hello@quoteloop.site."
4. **Payment confirmed dialog** (shown once, then gone for good): success icon, "Payment
   successful", "You're subscribed to QuoteLoop. Your plan renews on {date}. A receipt is on its
   way to your email.", primary "Continue" (Escape and clicking outside also close it). Per
   GOV.UK confirmation guidance also consider: what happens next (renewal date), how to get a
   record (receipt email / Manage billing), and how to get help (contact email). This is a rare,
   happy moment: it may be the one place with a little more warmth, but no confetti or bounce.
5. After closing: the Billing section shows "Active · Renews {date}" and no leftover message.

### 7.15 Sign up, log in, password (`/signup`, `/login`, `/forgot-password`, `/reset-password`)
- **Log in:** "Welcome back" (improve), "Log in to see who needs a follow-up today.", "Continue
  with Google" (official Google "G" mark is allowed), divider "or with email", Email
  (you@business.com), Password ("Your password"), "Forgot password?", "Log in", "New to
  QuoteLoop? Create an account".
- **Sign up:** "Start following up", same Google button, Email, Password ("At least 8
  characters"), "Create account", "Already have an account? Log in". After submit: "Check your
  email" / "We sent a confirmation link to {email}. Click it to activate your account. Open it in
  this browser to be signed in straight away." / spam hint / "Forgot password" / "Back to log
  in".
- **Forgot password:** "Reset your password", "Enter the email you log in with and we'll send
  you a link to choose a new password.", Email, "Email me a reset link", "Remembered it? Log in".
  Sent: "Check your email", "If there's a QuoteLoop account for {email}, we've emailed it a link
  to choose a new password.", "Open the link in this browser. It only works once. Nothing arrived
  after a few minutes? Check your spam folder, then try again.", "Use a different email". Expired
  link error.
- **Reset password:** "Choose a new password", "For {email}", "New password", "Type it again",
  "Save new password". Done: "Password changed", "Your new password is saved and you're logged
  in. Use it next time you log in with your email.", "Go to your dashboard".
- Errors: Appendix B.4. Auth screens should feel like the product, not a centred card floating
  on an empty page. No illustrations or stock photos.

### 7.16 Landing page (`/`)
Keep the content and order of information, redesign the presentation. Remove template
patterns from section 4 (centred hero formula, icon-tile grids, numbered steps unless truly
a sequence, four equal stat boxes, arrows on CTAs).
- Header: wordmark, "How it works", "Pricing", "FAQ", "Log in", "Start free".
- Hero: "Win more of the jobs you quote" (keep; it is specific), sub "QuoteLoop reminds you
  which quotes to chase, drafts the follow-up for you, and keeps every open quote in view until
  it's won or lost.", primary "Start 14-day free trial", secondary "See it in action", line
  "Free for 14 days, then $24.99 a month. No credit card to start." Real product screenshot.
- Proof points: "Reminders for every open quote", "AI drafts, you review", "Send from QuoteLoop
  or copy", "Track won and lost work".
- "What a lost quote really costs": $30,000 a year ("is what one forgotten $2,500 quote a month
  adds up to."), 52 quotes a year, $299.88 a year for QuoteLoop, 7× more likely (source: Harvard
  Business Review, 2011, link kept). Note "Examples use a $2,500 job. Your numbers will differ,
  but the sums work the same way." Do not present these as glowing metric cards.
- "How QuoteLoop works" (this one IS a sequence: add or send a quote → reminders are scheduled
  → write the follow-up → mark the result).
- "See it in action": four real screens with captions (Follow-ups, follow-up writer, Pipeline,
  phone views).
- "Everything you need to follow up, nothing you don't": nine capabilities (Quote tracking,
  Follow-up reminders, The right message for each stage, Send or copy, Won/lost tracking,
  Pipeline, Customer list, Any currency, CSV export). Not a 3×3 icon-card grid.
- "What your customer receives": the example email (From "Northside Home Services via
  QuoteLoop", Reply to, Subject, body to Marcus, signature, footer line) with its three facts.
- "Keep quoting the way you do now" and "Built for businesses that send quotes" with trade
  links (Roofing, HVAC, Plumbing, Electrical, Cleaning, Landscaping, Painting, Pest Control,
  Garage Door).
- "AI drafts. You decide what gets sent." with the four promises.
- "One simple price": $24.99/month, what's included, "Start 14-day free trial", "No credit card
  needed to start your trial."
- "Who's behind QuoteLoop": independent developer, contact email.
- "Questions": the 12 FAQs (cost, card, trial end, what it is, who it's for, past quotes,
  replace my CRM, automatic emails, what customers see, email limits, phone, Gmail access).
- Closing: "Stop letting quotes disappear quietly" + CTA.
- Footer: "© {year} QuoteLoop · Quote follow-up for small service businesses", Pricing,
  Contact, Privacy Policy, Terms of Service, Refund Policy.

### 7.17 Trade pages (`/for/{trade}`, e.g. `/for/plumbers`)
Same system as the landing page. "Quote follow-up for {trade}", start CTA, "See it in action",
"No credit card to start.", example follow-up card ("Follow-up due", "Example follow-up", "You
edit it, then send it or copy it. Nothing goes out on its own."), "Why quotes go cold for
{trade}", "How QuoteLoop helps" (4 points), "Your follow-ups for the day, in one place" with a
screenshot, the customer email preview, "QuoteLoop for other trades" links, closing CTA.

### 7.18 Legal pages (`/privacy`, `/terms`, `/refunds`)
Readable long-form text: header with wordmark, "Log in", "Start free"; label "Legal"; title;
"Effective date: …"; sections with headings, paragraphs, lists, links; footer. Comfortable
measure (60 to 75 characters), clear heading hierarchy. No decoration.

### 7.19 System pages
- 404: "Page not found", "This page doesn't exist or has moved. Check the address, or carry on
  from here.", "Go to dashboard", "QuoteLoop home".
- App error: "Something went wrong", "If you were saving a change, it may not have gone through.
  Check your connection, then try again.", "Try again". Site error: "We couldn't load this page.
  Your data is safe. Try again." + "Reference: {id}".
- Loading: skeletons matching each page (not the word "Loading…" alone).

### 7.20 Marketing screenshots and social image
After the app screens are designed, the landing page and trade pages need new screenshots
(desktop dashboard, follow-ups, follow-up writer, pipeline; phone dashboard and follow-ups)
using the sample data in section 10. Also redesign the social sharing image (1200×630):
"QuoteLoop", "Win more of the jobs you quote", "Follow-up reminders and AI-drafted follow-ups
for small service businesses", "14-day free trial".

---

## 8. Feedback and message system (how every message is presented)

### 8.1 Choose the pattern by weight
| Situation | Pattern |
|---|---|
| A field is wrong or missing | Inline error under the field + keep the input; for forms with several errors, a summary at the top that receives focus |
| An action on a row failed | Inline message on that row |
| Something happened that the user should know but needn't act on | Toast (with Undo when reversible) |
| Account-level condition (read-only, payment failed, trial ending, sample data) | One page banner by priority (7.0) |
| A serious or irreversible action | Designed confirmation dialog |
| End of a rare journey (payment, first quote created) | Confirmation dialog/panel with what happens next |
| Page could not load | Full-page error with Try again |

### 8.2 Errors
Plain words, what happened and the fix, near the cause, never colour alone, keep input, no
blame. Reuse the existing messages in Appendix B (they already follow these rules); restyle
them consistently.

### 8.3 Success
Confirm the outcome and let people continue. If something was created, offer a way to see it
("View follow-ups"). Same wording pattern across the product. Remove transient success messages
when the user moves on. Never auto-dismiss anything important.

### 8.4 Empty states
Three kinds: first use (blank slate, invites the first action), cleared/finished ("You're all
caught up"), and no results for a search/filter (offer to clear the search). Short title,
one sentence, one action.

### 8.5 Confirmations: replace every native browser pop-up
Design one confirmation dialog and use it for all of these (today they are grey `window.confirm`
boxes or none):
| Trigger | Message | Buttons |
|---|---|---|
| Delete quote (⋯ menu) | "Delete “{title}”? Its follow-ups and messages are deleted too. Records of emails QuoteLoop already sent are kept." | "Delete quote" (danger) / "Keep quote" |
| Delete customer | "Delete {name}? Their quotes and follow-ups are deleted too. Records of emails QuoteLoop already sent are kept." | "Delete customer" / "Keep customer" |
| Remove sample data (banner, dashboard, settings) | "Remove the sample customers and their quotes? Anything you added yourself stays." | "Remove sample data" / "Keep it" |
| Delete all data | type-to-confirm, see 7.12 | "Delete everything" / "Cancel" |
| Close a dialog with unsaved typing | "Close without saving? What you typed will be lost." (and the variants in 7.3 to 7.10) | "Discard" / "Keep editing" |
| "Add business email" link while a form has unsaved text | "Go to Settings? What you typed here won't be kept." | "Go to Settings" / "Stay here" |
No default focus on the destructive button; Escape cancels.

---

## 9. Responsive, accessibility and motion requirements

- Breakpoints: phone (390px reference, test 360px), tablet (768px), desktop (1280px, test
  1024px and 1440px). No horizontal page scroll at any width; long names and amounts wrap or
  truncate with the full value available.
- Touch targets at least 44×44px on phone; spacing between adjacent targets.
- Visible keyboard focus on every interactive element (not only colour); logical tab order;
  dialogs trap focus and return it; menus support arrow keys and Escape.
- Every icon-only control has an accessible name and tooltip. Status is never colour alone.
- Text contrast AA; respect user font scaling (layouts survive 200% text zoom).
- `prefers-reduced-motion` respected.
- Phone: the first screen of Dashboard, Quotes and Follow-ups shows real work, not banners.
  Bottom tab bar never covers the last item or a dialog's buttons.

---

## 10. Sample data to use in every mock-up

Business: **Northside Home Services**, owner **Ana Rivera**, USD, business email
hello@northsidehome.com. Today: 2 Nov 2026.

| Customer | Company | Quote | Amount | State |
|---|---|---|---|---|
| Hannah Brooks | The Corner Bakery | Illuminated shopfront sign | $2,150.00 | Sent 1 Nov, follow-up #2 overdue (was due yesterday) |
| Marcus Reed | Reed & Co Offices | Servicing of 3 split-system AC units | $780.00 | Sent 2 Nov, follow-up #2 due today, 1 more scheduled |
| Priya Nair | | Living + dining room redesign | $5,400.00 | Negotiating, follow-up #3 due tomorrow |
| Tom Alvarez | | Custom walnut dining table (seats 8) | $3,200.00 | Draft, not sent (customer stage: Contacted) |
| Dana Whitfield | | End-of-lease deep clean (2-bed) | $320.00 | Won |
| Sofia Martins | Greenline Properties | Weekly office cleaning contract (12 months) | $4,800.00 | Lost |
| Leo Grant | | | | New customer, no quote yet |

Totals for the dashboard: $8,330.00 waiting in 3 open quotes, $13,450.00 quoted in total,
1 won ($320.00), 1 lost ($4,800.00), win rate 50%, average quote $2,690.00, 5 quotes sent,
5 active customers. Also show one multi-currency example (a quote in GBP) in at least one
mock-up to prove currencies are never added together.

---

## 11. Acceptance checklist (run on your own output before handing over)

Visual
- [ ] No purple/indigo/violet, no cream + terracotta, no near-black + neon, no emerald fallback.
- [ ] No gradient text, gradient buttons, glows, blobs, grain, glass.
- [ ] Typeface is a stated choice (not on the 4.2 list); 6 to 8 sizes; tabular figures for money.
- [ ] No ALL-CAPS labels, no eyebrow labels, sentence case everywhere.
- [ ] At most 3 radii; one elevation rule; no ghost cards, side stripes, nested cards.
- [ ] No identical icon-card grids, no bento, no hero-metric dashboard, no charts added.
- [ ] No middle-dot meta habit, no "→" on buttons/links, no em dashes in copy.
- [ ] No sparkles icon; every icon matches its meaning; no emoji.
- [ ] One spacing scale; list a count of every radius, shadow, gap and font size used (a value
      used once is probably a mistake).

Function and states
- [ ] Every element in section 7 exists; nothing exists that isn't in section 7.
- [ ] Every screen in desktop and phone; every listed state (empty, first use, loading, error,
      success, read-only, sample data, slow payment, payment confirmed).
- [ ] "New quote" appears once per viewport.
- [ ] At most one account banner at a time; plain trial is not a banner.
- [ ] Quote items show at most one primary + one secondary action; the rest in ⋯.
- [ ] No native `window.confirm` anywhere; all confirmations per 8.5.
- [ ] Payment journey 7.14 fully designed, confirmation appears once and goes away.
- [ ] Pipeline columns never clipped; stage change control is designed.

Accessibility and copy
- [ ] Contrast AA measured; focus states visible; 44px phone targets; reduced motion.
- [ ] Every button label is a specific verb; no Yes/No/OK/Submit/Learn more/Get started.
- [ ] No buzzwords from 4.7; no invented claims, numbers or testimonials.

Process
- [ ] Three directions proposed, each self-reviewed against section 4, one recommended, with
      notes on what was revised and why.
- [ ] A short "Questions" list for anything that seemed missing (instead of inventing it).

---

## Appendix A: research sources

- Anthropic, frontend-design skill: https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md
- Anthropic, Improving frontend design through Skills (Nov 2025): https://www.claude.com/blog/improving-frontend-design-through-skills
- Anthropic cookbook, Prompting for frontend aesthetics: https://github.com/anthropics/claude-cookbooks/blob/main/coding/prompting_for_frontend_aesthetics.ipynb
- Signs of AI design (field guide + design-rules.md): https://github.com/febbhav/signs-of-ai-design
- Impeccable, AI slop catalogue: https://impeccable.style/slop
- NN/g, The proliferation and problem of the sparkles icon: https://www.nngroup.com/articles/ai-sparkles-icon-problem/
- NN/g, Error-message guidelines: https://www.nngroup.com/articles/error-message-guidelines/
- NN/g, Confirmation dialogs: https://www.nngroup.com/articles/confirmation-dialog/
- GOV.UK Design System, error message, error summary, validation, notification banner, confirmation pages: https://design-system.service.gov.uk/
- Atlassian Design, empty state, error messages, flag: https://atlassian.design/foundations/content/designing-messages/
- Wikipedia, Signs of AI writing: https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing
- Critiques: 925 Studios (AI slop web design guide; fonts and gradients), Illos AI slop checklist, SmoothUI, prg.sh "purple gradient", Plainify "vibe-coded apps", SCALR "20 signs", TeneX "8 signs", aitoolpick 30-point checklist, uxskill "AI dashboards look the same", gendesigns "15 mistakes", AskCodi "The AI UI problem".

## Appendix B: message catalogue (keep meaning; restyle by section 8)

### B.1 Shared
- "That didn't go through, so nothing changed. You may have lost your connection, or been signed out in another tab. Refresh the page and try again."
- "QuoteLoop couldn't be reached. Check your connection and try again."
- "Couldn't copy automatically. Select and copy the message manually." / "Copied!"
- "This quote no longer exists. It may have been deleted in another tab."
- "This customer no longer exists. They may have been deleted in another tab."

### B.2 Quotes and the new-quote flow
- Validation: "Choose which customer this quote is for." · "Enter the customer's name." · "Enter the customer's email address so QuoteLoop can send the quote." · "That email address doesn't look right. Check it and try again." · "That email address doesn't look right. Leave it empty if you don't have one." · "Add a short title for the quote, like “Service 3 AC units”." · "Enter the quote amount as a number greater than zero." · "That amount is too large. Check the number and try again." · "Enter a number, like 1250 or 1,250.00." · "Enter the date you sent this quote." · "The sent date can't be in the future." · "The valid-until date can't be before today." · "The valid-until date can't be before the sent date." · "The description is too long. Keep it under {n} characters." · "The notes are too long. Keep them under {n} characters." · "Choose a currency." · "{Field} isn't a real date. Check it and try again."
- Send problems: "You changed the quote details after editing this email, so it may still mention the old ones. Check the text and press Send quote email again, or use “Rewrite with the new details”." · "This email is too long to send. Keep it under 10,000 characters." · "We couldn't confirm whether the quote email was sent. Check this customer's quotes before trying again." · "QuoteLoop couldn't send the quote just now, so nothing was sent. Your quote is saved as a draft, so you can try again." · "This quote is already marked as sent, so the quote email wasn't sent again." · "This quote email was already sent from QuoteLoop, so it won't be sent again. Use “I already sent this” on the quote to start its follow-up reminders." · "QuoteLoop couldn't confirm whether an earlier attempt to send this quote was delivered, so it may already have reached your customer. To avoid sending it twice, it won't be sent again from here. If they have it, use “I already sent this”; if not, copy the email and send it yourself." · "This customer doesn't have a valid email address any more, so the quote can't be sent. Add one on the Customers page, or use “I already sent this” if you sent it another way." · "Email sending isn't available right now, so nothing was sent. You can still copy the message."
- Row hints: "This is a sample quote, so it can't be emailed. Use “I already sent this” to try the follow-up reminders." · "Email sending is not configured. You can still track a quote you sent elsewhere." · "Add your business email in Settings before sending from QuoteLoop, or use “I already sent this” if you sent it another way." · "Add an email address to send this quote from QuoteLoop, or mark it as already sent if you sent it elsewhere."
- Status changes: "That can't be undone. Use the quote's menu to change its status." · "This quote has changed since, so there's nothing to undo." · "This quote is marked {won/lost}, so its reminders stay closed. To follow up again, use “Reopen as sent” on the quote." · "Quote updated, but its follow-up reminders couldn't all be moved to match the new sent date. Check them on the Follow-ups page."
- Saving: "The quote couldn't be saved just now. Please try again." · "The quote couldn't be deleted just now. Please try again." · "The follow-up couldn't be logged just now. Check the quote's follow-ups, then try again." · "This follow-up was already recorded, maybe in another tab, so nothing new was logged." · "There's no follow-up reminder left on this quote, so there was nothing to log."

### B.3 Follow-ups and the follow-up writer
- "This follow-up was already completed, maybe in another tab." · "This reminder was already skipped: a follow-up you recorded covered it, or it was skipped in another tab." · "This reminder no longer exists. Its quote may have been deleted." · "This reminder changed in another tab. Refresh the page and try again." · "The reminder couldn't be updated just now. Please try again." · "The reminder couldn't be moved just now. Please try again." · "Choose how long to snooze this reminder."
- Writer: "QuoteLoop couldn't write a message just now. Please try again, or write one yourself." · "QuoteLoop's AI writer isn't available right now, so this is a template you can edit." · "No AI key is configured, so this is a template you can edit." · "The message was written but couldn't be saved to history." · "AI drafts are unavailable just now. You can still write or edit a message yourself." · "You've reached the limit of {n} AI drafts in 24 hours. You can still write or edit a message yourself." · "Email sending isn't set up for this workspace, so copy the message and send it yourself." · "Add an email address to this customer to send from QuoteLoop." · "That didn't go through, so nothing was logged. …" · "Nothing was logged." · Email limits: "You've reached the limit of 25 emails from QuoteLoop in 24 hours. You can still copy the message and send it yourself." · "You've reached the limit of 100 emails in 30 days. You can still copy the message and send it yourself."

### B.4 Sign in and account
- "Use at least 8 characters for your password." · "Sign-in didn't complete. Please try again. If you were confirming your email, log in with your password." · "Google sign-in isn't set up yet. Please use your email and password." · "QuoteLoop couldn't reach the sign-in service. Check your connection and try again in a minute." · "Couldn't start Google sign-in. Please try again." · "That reset link didn't work. It may have expired, already been used, or been opened in a different browser from the one you asked for it in. Enter your email to get a new one." · "Use at least 8 characters for your new password." · "The two passwords don't match. Type the same password in both boxes."

### B.5 Settings and data
- "Enter your business name." · "Enter your name." · "Choose your type of business." · "Choose at least one follow-up day." · "That business email doesn't look right. Check it, or leave it empty." · "The phone number is too long. Keep it under {n} characters." · "{Field} is too long. Keep it under {n} characters." · "Your settings couldn't be saved just now. Please try again." · "Your workspace wasn't found. Refresh the page and try again." · "Sample data can only be loaded into an empty workspace. Use “Delete all data” first if you want a fresh set." · "Sample data only partly loaded. Use “Remove sample data” to clear it, then try again." · "There's no sample data to remove." · "QuoteLoop couldn't finish removing the sample data. Anything already removed stays removed. Please try again." · "QuoteLoop couldn't finish deleting your data (it stopped at your {table}). Anything already deleted stays deleted. Please try again." · "QuoteLoop couldn't be reached, so your data may not have been deleted, or only partly. Refresh the page to check, then try again."

### B.6 Customers and pipeline
- "Enter the customer's name." · "That email address doesn't look right. Check it, or leave it empty." · "You already have a customer with {email/phone}: {name}. If this is a different customer, press “Add anyway”." · "Another customer, {name}, already has {email/phone}. If that's right, press “Save anyway”." · "The customer couldn't be saved just now. Please try again." · "The customer couldn't be deleted just now. Please try again." · "The customer couldn't be moved just now. Please try again." · "That isn't a stage QuoteLoop knows."

Note on "Please": several existing messages use "Please try again". Under section 4.7, drop
"Please" where the sentence works without it.

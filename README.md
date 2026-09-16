# QuoteLoop

**Win more jobs from the quotes you already send.**

QuoteLoop is a focused quotation follow-up CRM for small service businesses —
contractors, electricians, plumbers, AC repair, cleaners, printers/signage,
interior designers, furniture makers, freelancers and small agencies. It helps
them **track sent quotes, get follow-up reminders, and generate AI-written
follow-up messages** so quoted deals don't go cold.

It is a self-contained micro-SaaS MVP built with Next.js + Supabase, designed to
be **demo-ready and easy to hand over**.

---

## Table of contents

1. [Tech stack](#tech-stack)
2. [Core loop](#core-loop)
3. [Setup instructions](#1-setup-instructions)
4. [Environment variables](#2-environment-variables)
5. [Supabase schema / migration notes](#3-supabase-schema--migration-notes)
6. [AI prompt design](#4-ai-prompt-design)
7. [Manual QA checklist](#5-manual-qa-checklist)
8. [Known limitations](#6-known-limitations)
9. [Suggested next features](#7-suggested-next-features)
10. [Buyer / demo talking points](#8-buyer--demo-talking-points)

---

## Tech stack

- **Next.js 15** (App Router) + **TypeScript**
- **Supabase** — Auth (email/password) + Postgres with **Row Level Security**
- **Tailwind CSS**
- **Server-side AI endpoint** — Anthropic Claude **or** any OpenAI-compatible API,
  with a built-in **template fallback** so the app works with no AI key
- **CSV export** (no external dependency)

Only six runtime dependencies (`next`, `react`, `react-dom`, `@supabase/ssr`,
`@supabase/supabase-js`, `lucide-react`) — deliberately lean for easy handover.

## Core loop

Add lead → Add quote → Mark quote sent (auto-schedules follow-ups) → Generate AI
follow-up → Copy & send yourself → Mark won/lost → Watch the dashboard.

Pages: **Dashboard**, **Leads**, **Quotes**, **Follow-ups**, **Pipeline**,
**Settings**.

---

## 1. Setup instructions

### Prerequisites

- Node.js 18.18+ (Node 20+ recommended)
- A free [Supabase](https://supabase.com) project

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.local.example .env.local
# then edit .env.local with your Supabase URL + anon key (see section 2)

# 3. Create (or update) the database
#    Open Supabase -> SQL Editor -> paste the contents of supabase/schema.sql -> Run
#    Re-run this whenever you pull a release that changes the schema.

# 4. (Recommended for demos) Turn OFF email confirmation
#    Supabase -> Authentication -> Providers -> Email -> disable "Confirm email"
#    This lets a new signup log straight in. Leave it ON for production.

# 5. Run the app
npm run dev
# open http://localhost:3000
```

> A placeholder `.env.local` may already exist so the UI boots for a preview —
> replace its values with your real Supabase keys before signing up.

### First run

1. Sign up with an email + password.
2. Complete the one-screen **onboarding** (business name, industry, currency).
3. Go to **Settings → Load demo data** to populate realistic sample records, or
   start adding your own leads.

### Production build

> **Re-run `supabase/schema.sql` before deploying this quote-flow update.**
> Open Supabase → SQL Editor, paste the file, Run. It is idempotent and safe to
> re-run on a live database. This release depends on it: it adds
> `quotes.sent_method`, makes `email_logs.quote_id` / `lead_id` nullable so
> sent-email history survives a deleted quote, and installs the
> `insert_email_log_within_limits` function that stops two simultaneous sends
> from passing the same limit. Deploy the code **after** the schema has been
> applied.

```bash
npm run build && npm start
```

Runs anywhere `next start` runs (a plain Node server — no edge runtime needed).

**Railway (current deployment):** New Project → Deploy from GitHub repo. Nixpacks
runs `npm run build` then `npm start`, and `next start` binds to Railway's `$PORT`
automatically. Set the variables below in the service's **Variables** tab
*before* the first build — the two `NEXT_PUBLIC_*` values are baked in at build
time, so changing them later needs a redeploy. Then **Settings → Networking →
Generate Domain**, and paste that URL into Supabase → Auth → URL Configuration →
**Site URL**.

Vercel works the same way (set the variables in the project settings).

> Demo from the production build or the deployment, not `npm run dev` — the
> Next.js dev overlay shows its own warnings that aren't app errors.

---

## 2. Environment variables

All configured in `.env.local` (see `.env.local.example`).

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL (Project Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `DEEPSEEK_API_KEY` | ⬜ | **Simplest way to turn on AI** — just set this one variable. Endpoint (`https://api.deepseek.com`) and model (`deepseek-chat`) are built in. |
| `ANTHROPIC_API_KEY` | ⬜ | Enables AI messages via Anthropic (Claude) instead. |
| `OPENAI_API_KEY` | ⬜ | Any other OpenAI-compatible endpoint (OpenAI, Groq, Together, OpenRouter, local). |
| `OPENAI_BASE_URL` | ⬜ | Override for the OpenAI-compatible base URL. Defaults to `https://api.openai.com/v1`. |
| `AI_MODEL` | ⬜ | Model override. Defaults: `deepseek-chat` (DeepSeek), `claude-haiku-4-5-20251001` (Anthropic), `gpt-4o-mini` (OpenAI). |
| `APP_TIMEZONE` | ⬜ | **Deployment fallback** time zone, used only until a viewer's browser time zone is known. Not a business setting. Defaults to `UTC`. |
| `RESEND_API_KEY` | ⬜ | Turns on **Send email** in the AI assistant (Resend). Server-only. |
| `EMAIL_FROM` | ⬜ | Sender address on your **verified** Resend domain, e.g. `QuoteLoop <followups@yourdomain.com>`. Required together with `RESEND_API_KEY`. |
| `EMAIL_REPLY_TO` | ⬜ | Reply-To used when the business profile has no email address. |

Provider priority when several keys are set: **Anthropic → DeepSeek → OpenAI → templates**.

### Time zones

QuoteLoop is global: there is no built-in country, currency or time zone.
"Today", due, overdue, reminder dates and the dashboard greeting follow each
**viewer's own browser time zone**. The browser shares it with the server via a
small cookie, and every date is computed server-side, so all pages agree.

- **`APP_TIMEZONE` is a server fallback**, used to keep date classification
  consistent in production before a viewer's zone is known (their very first
  request, or browsers that block cookies). For a global deployment keep it at
  `UTC`, or set it to your primary market. For a private demo, set it to the demo
  operator's own zone.
- It is **not** a per-business setting. A stored business time zone is
  recommended before adding anything that runs without a browser (email/SMS
  reminders, scheduled digests) or multi-user workspaces.

### Google sign-in

"Continue with Google" appears on the login and signup pages. It uses Supabase
Auth (OAuth with PKCE) and needs **no app environment variables**.

1. **Google Cloud Console → APIs & Services → Credentials → Create OAuth client
   ID** (type *Web application*). Set up the OAuth consent screen with the default
   `openid`, `email` and `profile` scopes only — no Gmail or other scopes.
2. **Authorized redirect URI:** copy the *Callback URL* shown in Supabase →
   Authentication → Providers → Google (it looks like
   `https://<project-ref>.supabase.co/auth/v1/callback`) into the Google client.
   Add your app URL(s) under *Authorized JavaScript origins*.
3. **Supabase → Authentication → Providers → Google:** enable it and paste the
   Google client ID and secret.
4. **Supabase → Authentication → URL Configuration:**
   - **Site URL:** your production URL, e.g. `https://<your-domain>` (same
     scheme and host). Supabase always allows redirects back to this site.
   - **Redirect URLs:** add `https://<your-domain>/auth/callback**`, and for local
     development `http://localhost:3000/**`. Keep the `**`: the callback URL
     carries a `?next=` path and Supabase matches the whole URL, so an entry
     without it won't match. Don't add wildcards for domains you don't control.
5. Sign in with Google. New users land in onboarding (name and email prefilled
   from Google); returning users land on the dashboard.

Google always returns to `/auth/callback` on the current site, which exchanges the
one-time code for a session and then continues to a **same-site path only** (no
open redirects). Email/password sign-in is unchanged. Email-confirmation links now
use the same callback, so confirming an address in the same browser signs the user
straight in (keep Supabase's default "Confirm signup" email template). Until Google
is enabled in Supabase, the button says Google sign-in isn't set up yet instead of
opening Google.

### Email sending (manual, 1-to-1)

From the AI assistant, users can email the reviewed follow-up to the customer's
**saved** email address with **Send email**. Nothing is ever sent automatically,
and every email needs an explicit click.

- **Provider:** Resend, called server-side with `fetch`. The key never reaches
  the browser.
- **Variables:** `RESEND_API_KEY`, `EMAIL_FROM` (an address on a **verified**
  Resend domain), and optionally `EMAIL_REPLY_TO`.
- **Sender and replies:** the sender shows as "*Business name* via QuoteLoop".
  Replies go to the business email in Settings, or `EMAIL_REPLY_TO`. With
  neither set, replies go to the `EMAIL_FROM` address.
- **Audit and logging:** every attempt is written to `email_logs` **before**
  sending, then marked `sent` or `failed`. The reminder is marked done only after
  the provider accepts the email, and it stores the final (edited) text. Users can
  read their log but can't edit or delete entries, and deleting a quote or
  customer detaches its entries rather than removing them.
- **Unclear outcomes:** if Resend doesn't answer clearly (a timeout or dropped
  connection), the attempt stays `pending`, shows as "delivery not confirmed", and
  the assistant won't offer an immediate resend. Check the Resend dashboard
  (Emails) to see whether it went out.
- **Limits:** 25 emails per user in any 24 hours and 100 in any 30 days (sent and
  unconfirmed attempts count; rejected ones don't). AI drafts are limited to 50
  per user in any 24 hours.
- **Limits are enforced in the database.** A send writes its audit row through
  `insert_email_log_within_limits`, which counts and inserts inside one
  transaction behind a per-user advisory lock, so two sends started at the same
  moment can't both pass. If the code is deployed before the schema is applied,
  the app falls back to inserting first and then checking its position in the
  window — a safety net for that gap, not a configuration to run on.
- **Schema (required):** `supabase/schema.sql` must be re-run before this
  release is deployed. It adds `email_logs`, the send-limit function and
  `quotes.sent_method`, and stops sent-email records from being deleted along
  with their quote. Deploying without it degrades quietly rather than crashing —
  how a quote was sent isn't recorded, email history still disappears with its
  quote, and send limits fall back to the weaker check — so treat it as part of
  the deploy, not a follow-up task.

**Setup:**
1. In Resend, add your domain and verify its DNS records (add DMARC too).
2. Create an API key.
3. Set the variables in Railway and redeploy.
4. Put a monitored address in Settings → Business email, since replies go there.

**Limitations:**
- Manual 1-to-1 follow-ups only: no sequences, bulk or scheduled sending.
- No unsubscribe or suppression handling yet.
- Emails are plain text.
- Rate limits are basic per-user counts: deleting a quote also deletes its email
  log (freeing that part of the limit), and two simultaneous sends can both pass.
- Bounces and delivery status aren't surfaced.
- Anyone who can sign up can email the addresses they save as customers (within
  the limits) from your domain, so keep sign-ups controlled until abuse controls
  exist.

Before production scale, add suppression/opt-out handling, a global send cap and
domain monitoring.

**AI is optional.** With no key set, QuoteLoop uses smart built-in templates,
so it is fully demoable offline. Add a key to switch on real AI generation.

Only the two `NEXT_PUBLIC_` values reach the browser; AI keys stay server-side
(used only inside the `/api/generate-message` route).

---

## 3. Supabase schema / migration notes

The entire schema lives in **`supabase/schema.sql`** — run it in the Supabase SQL
editor, and re-run it as part of any deploy that changes it, **including this
quote-flow release**. It is idempotent (`create table if not exists`, `drop
policy if exists`, `add column if not exists`), so re-running it on a live
database is safe and leaves existing rows untouched.

### Tables

| Table | Purpose |
| --- | --- |
| `businesses` | One workspace/settings row per user (`unique(user_id)`) |
| `leads` | Potential customers |
| `quotes` | Quotes, each belonging to a lead |
| `follow_ups` | Scheduled reminders per quote |
| `messages` | AI-generated message history per quote |
| `email_logs` | Every email sent (or attempted) from QuoteLoop, and the send limits |

### Data isolation (important)

- Every table has a `user_id` column defaulting to `auth.uid()` and referencing
  `auth.users(id)` with `ON DELETE CASCADE`.
- **Row Level Security is enabled on every table**, with a single policy per table
  scoped to the `authenticated` role: rows must satisfy `auth.uid() = user_id`,
  and on insert/update every *referenced* lead or quote must also belong to the
  caller. (Without that second check a user could attach rows to another
  tenant's lead, and that tenant deleting the lead would cascade-delete them.)
- **Already ran an older copy of the schema?** Re-run `supabase/schema.sql` — it's
  idempotent and replaces the policies in place.
- Result: a signed-in user can only ever read or write **their own** rows.
  Server queries also add an explicit `.eq("user_id", user.id)` as defence in depth.
- `ON DELETE CASCADE` means deleting a lead cleans up its quotes, follow-ups and
  messages automatically.
- **`email_logs` is the exception.** Deleting a quote or a customer sets the
  record's `quote_id` / `lead_id` to null instead of deleting it, so a record of
  an email that really was sent survives — for the user's own history, and so
  the send limits can't be reset by deleting things. There is still no delete
  policy on the table; only deleting the account clears those rows.

### Status values

Enforced by `CHECK` constraints and mirrored in `lib/constants.ts`:

- **Lead:** `new, contacted, quote_sent, follow_up_due, negotiating, won, lost, cold`
- **Quote:** `draft, sent, follow_up_due, negotiating, accepted, rejected, expired`
- **Follow-up:** `pending, completed, skipped`

### Follow-up scheduling logic

Every quote status change — Mark sent, Won/Lost, the status dropdown, or the edit
form — goes through one function (`applyQuoteStatusChange` in
`lib/quote-state.ts`), so all paths behave identically:

- **→ Sent:** reads the business's `default_follow_up_days` (e.g. `{1,3,7,14}`),
  replaces any *pending* reminders with one per interval dated `today + N days`
  (numbering continues after existing history), and moves a `new`/`contacted`
  lead to `quote_sent`. Marking an already-sent quote as sent is a no-op.
- **→ Accepted / Rejected / Expired:** pending reminders are marked `skipped`, so a
  decided quote is never shown as due. Accepted moves the lead to `won`; Rejected
  moves it to `lost` only if the lead has no other open or won quote.
- **Counters are derived, never incremented:** `follow_up_count`,
  `last_follow_up_at` and `next_follow_up_at` are always recomputed from the
  quote's reminder rows (`deriveQuoteFollowUpState` in `lib/follow-up-state.ts`),
  whichever screen changed them. The demo seed uses the same function.
- **"Due today" / "Overdue"** use one classifier shared by the dashboard and the
  Follow-ups page, with "today" computed on the server in the viewer's browser
  time zone (falling back to `APP_TIMEZONE`, then UTC).

### Migrations

For a real migration workflow, drop `schema.sql` into `supabase/migrations/` and
use the Supabase CLI (`supabase db push`). For this MVP, running the single SQL
file is enough.

---

## 4. AI prompt design

Implemented in `lib/ai/prompts.ts` (prompt building) and `lib/ai/provider.ts`
(provider calls + fallback). The endpoint is `app/api/generate-message/route.ts`.

### Inputs collected per message

`business_name`, `industry`, `owner_name`, `customer_name`, `quote_title`,
`quote_description`, `quote_amount` + `currency`, `quote_date`, `days_since_sent`,
`previous_follow_up_count`, `desired_tone`, `message_type`, and an optional
`objection` / extra context.

### Message types

`first_follow_up`, `second_follow_up`, `final_follow_up`, `quote_expiring`,
`objection_response`, `lost_lead_recovery`, `thank_you_after_acceptance`. Each maps
to specific guidance that shapes the ask (a gentle first check-in vs. a respectful
final nudge vs. an objection response, etc.).

### System prompt (summary)

> You write short follow-up messages a small service business sends to a customer
> about a price quote. Output only the message body (ready to paste), 2–5
> sentences, sound like a real person, never invent facts or fake prior
> conversations, respect the customer's time, match the requested tone, use the
> customer's first name and sign off with the business/owner name when provided.

The user prompt supplies the structured context above plus the per-type guidance.

### Safety & product rules

- **Never auto-sends.** The endpoint only returns text.
- The generated message is shown in an **editable** textarea with a persistent
  **"Review and edit before sending"** banner.
- The user **copies manually** (copy button) and sends via their own channel.
- Every generation is **stored in `messages`** (history per quote), shown in the
  modal and copyable again.
- **Graceful degradation:** if the AI call fails or no key is configured, a
  deterministic template is returned and clearly labelled, so the workflow never
  breaks in a demo.

### Provider selection

`ANTHROPIC_API_KEY` → Anthropic Messages API. Else `DEEPSEEK_API_KEY` → DeepSeek
(`https://api.deepseek.com`, `deepseek-chat`). Else `OPENAI_API_KEY` → any
OpenAI-compatible `/chat/completions`. Else → template. DeepSeek and OpenAI share
one code path; only the base URL, model and key differ. All calls are plain
`fetch` (no SDK), keeping dependencies minimal.

---

## 5. Manual QA checklist

**Auth & isolation**
- [ ] Sign up creates an account; onboarding creates exactly one business.
- [ ] Log out / log in works; visiting `/dashboard` while logged out redirects to `/login`.
- [ ] Create a second account → it sees **none** of the first account's data.

**Leads**
- [ ] Create, edit, delete a lead (delete asks for confirmation).
- [ ] Search by name/company/email and filter by status both work.
- [ ] Empty state shows when there are no leads.

**Quotes**
- [ ] Create a quote for a lead (New quote is disabled until a lead exists).
- [ ] "Mark sent" creates follow-up reminders and sets the next follow-up date.
- [ ] Won/Lost buttons and the status dropdown update the quote.
- [ ] Edit and delete (with confirm) work.

**Follow-ups**
- [ ] Reminders appear under Due today / Overdue / Upcoming / Completed correctly.
- [ ] Complete, Skip and Reopen update the quote's counters.

**AI message**
- [ ] Generate produces an editable message; "Review before sending" is visible.
- [ ] Copy works; history lists previous messages.
- [ ] With no AI key, a labelled template appears (no crash).
- [ ] "Mark follow-up sent" completes the next reminder.

**Dashboard & pipeline**
- [ ] Dashboard stats (due today, overdue, win rate, values) match the data.
- [ ] Pipeline groups leads by stage; moving a card changes its status.

**Export & settings**
- [ ] Leads / Quotes / Follow-ups CSV downloads open cleanly in a spreadsheet.
- [ ] Settings save; "Load demo data" and "Delete all data" (with confirm) work.

**States**
- [ ] Loading spinners show on submit; validation errors are surfaced; empty
      states render on every page.

---

## 6. Known limitations

- **Manual sending only.** QuoteLoop drafts messages; you copy them, or send one
  email at a time with an explicit click. No automatic, scheduled or bulk
  sending, no SMS or chat, and no unsubscribe/suppression handling yet.
- **No automated reminders.** Follow-up due dates are shown in-app; there are no
  push/email notifications yet (would need a cron job / edge function).
- **Single currency per business for totals.** Each quote stores its own currency,
  but dashboard/pipeline totals are summed and displayed in the business currency
  without FX conversion.
- **One workspace per user.** No teams, roles or shared workspaces.
- **Client-side search/filter.** Lists load all of a user's rows and filter in the
  browser — perfect for typical small-business volumes, not for tens of thousands
  of rows.
- **Email confirmation** is on by default in Supabase; disable it for a frictionless
  demo (see setup).
- **AI output is model-dependent** and should always be reviewed before sending.

---

## 7. Suggested next features

1. **Automated reminder notifications** — daily email/SMS digest of what's due
   (Supabase scheduled function).
2. **One-click send** integrations — mailto/SMS deep links pre-filled with the
   copied message.
3. **Quote PDF generation** — branded PDF a user can attach.
4. **Templates library** — save and reuse favourite follow-up messages per type.
5. **Analytics** — best follow-up day/number, response and win-rate trends.
6. **Teams** — multiple users per workspace with roles.
7. **Multi-currency totals** with live FX.
8. **Public quote links** with view tracking ("customer opened your quote").
9. **Import** leads from CSV / Google Contacts.
10. **Mobile app / PWA** for on-site tradespeople.

---

## 8. Buyer / demo talking points

- **Sharp positioning.** Not "another CRM" — it solves one expensive problem:
  quoted jobs that go cold because nobody followed up. Every quote is money already
  on the table.
- **Immediate, visible value.** The dashboard shows total quoted value, win rate,
  and follow-ups due *today* — an owner instantly sees revenue at risk.
- **The AI is the wedge.** "Generate a friendly follow-up in 3 seconds, review, and
  send." Removes the #1 reason people skip follow-ups: not knowing what to say.
- **Human-in-the-loop by design.** It never sends on the user's behalf — that's a
  trust and safety selling point, not a gap.
- **Wide market, low objection.** Contractors, tradespeople, cleaners, printers,
  designers, freelancers — anyone who sends quotes. Language is generic across all
  service niches.
- **Demo in 60 seconds:** Load demo data → dashboard (money at risk) → a quote →
  "AI message" → copy → mark won. The whole loop, start to finish.
- **Clean, sellable asset.** Small dependency surface, one SQL file, RLS-enforced
  data isolation, thorough docs → low diligence risk and fast handover to a buyer's
  team.
- **Cheap to run.** Supabase free/low tier + optional pay-as-you-go AI (or free
  templates). Healthy SaaS margins at a low price point.

---

## Project structure

```
app/
  (app)/                 # authenticated area (sidebar layout + business guard)
    dashboard/  leads/  quotes/  follow-ups/  pipeline/  settings/
  api/
    generate-message/    # AI endpoint (POST generate + GET history)
    export/[type]/       # CSV export (leads | quotes | follow-ups)
  auth/signout/          # sign-out route
  login/  signup/        # auth pages
  onboarding/            # create the business workspace
components/              # UI + feature components (client)
lib/
  supabase/              # browser/server/middleware clients
  ai/                    # prompt building + provider (Anthropic / OpenAI / template)
  constants.ts  types.ts  utils.ts
supabase/schema.sql      # tables, indexes, triggers, RLS policies
```

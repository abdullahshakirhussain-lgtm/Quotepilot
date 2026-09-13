# QuotePilot — Demo-Readiness QA Report

_Scope: QA only. No new features, integrations, or redesigns._

## Verification method & boundary

- **Runtime-verified here:** production build (clean), landing/login/signup render,
  protected-route redirect (`/dashboard` → `/login?redirect=…`) in **both** dev and
  production servers.
- **Code-audited (not runtime-exercised here):** everything that requires a live
  Supabase project + real signed-in users — auth, onboarding, CRUD, follow-up
  scheduling, AI endpoint, dashboard math, RLS isolation. I can't enter real
  credentials or stand up your Supabase, so these were verified by reading the
  code, the SQL policies, and tracing each data flow. They should be confirmed
  once against your live project using the demo script below.

---

## 1. Bugs found

| # | Severity | Area | Description |
|---|----------|------|-------------|
| 1 | Medium (data accuracy) | Follow-ups / Quotes | `follow_up_count` was updated two different ways: the AI modal's **Mark follow-up sent** *incremented* it (`+1`), while the Follow-ups page *recomputed* it from rows. Using both on one quote made the count drift and disagree with reality. |
| 2 | Medium (demo quality) | Demo seed | Seeded quotes had `follow_up_count` = 1/2/1 but only **one** completed follow-up row existed (Dana's). Counts didn't match the rows, the Follow-ups "Completed" section was nearly empty, and the numbers would visibly jump the first time a user completed/reopened anything. |
| 3 | Low (resilience) | Error/loading states | No route-level error or loading boundary in the app area. A failed Supabase query mid-demo would drop to Next's raw error page. |
| 4 | Not app code (environment) | Dev tooling | `next dev` (Next 15.5.x) logs a `segment-explorer-node … React Client Manifest` error and shows a red **"1 Issue"** badge. **Production build + `next start` are clean** (verified). This is a known Next dev-tools bug, not a QuotePilot defect. |

Areas audited and found **correct** (no change needed): RLS policies vs. app
queries (every table `auth.uid() = user_id`, plus explicit `.eq("user_id", …)` in
queries); status enums in `lib/constants.ts` exactly match the SQL `CHECK`
constraints; CSV formula-injection escaping; date/section grouping for follow-ups;
dashboard metric formulas; auth redirect gating.

## 2. Fixes made

1. **Unified follow-up counting** — `logFollowUpSent` (`app/(app)/quotes/actions.ts`)
   now completes the earliest pending reminder and **recomputes** `follow_up_count`,
   `last_follow_up_at`, and `next_follow_up_at` from the rows — identical logic to
   the Follow-ups page. Both paths now always agree.
2. **Consistent, richer demo seed** — `seedDemoData` (`app/(app)/settings/actions.ts`)
   now inserts completed follow-up rows that match each quote's counters, and
   spreads reminders across **all four** sections (Completed / Due today / Overdue /
   Upcoming).
3. **Error & loading states** — added `app/(app)/error.tsx` (friendly error card
   with "Try again") and `app/(app)/loading.tsx` (loading indicator on navigation).
4. Re-ran a **clean production build** — passes; all 14 routes compile.

## 3. Remaining known issues (by design or minor)

- **Not runtime-tested against a live DB here.** Confirm auth/CRUD/RLS once on your
  Supabase using the demo script (RLS + query scoping are code-correct).
- **"Load demo data" stacks** if clicked repeatedly (the button is disabled while
  loading, so it's hard to trigger). Use **Delete all data** to reset, then load once.
- **Editing a draft's status to "Sent" in the quote form does not schedule
  reminders** — use the **Mark sent** button (which does). The form hint says so.
- **Won/Lost on a quote does not move the lead's pipeline stage** (kept independent
  by design; the pipeline is lead-driven and a lead can have multiple quotes).
- **`cold` leads don't show on the Pipeline board** (by design — matches the spec's
  seven columns); they still appear on the Leads page.
- **Multi-currency totals** are summed without FX conversion (demo data is all USD).
- **Supabase email confirmation is ON by default** → disable it for a frictionless
  demo (Auth → Providers → Email).
- **Dev-tools "1 Issue" badge** in `next dev` (finding #4) — cosmetic; demo from a
  production build or deployment.

## 4. Final demo script (~2 minutes)

> Best run from a **production build** (`npm run build && npm start`) or your
> Vercel deployment, and with Supabase email confirmation **off**.

1. **Landing** → click **Get started**.
2. **Sign up** (email + password) → **Onboarding**: enter a business name, pick an
   industry + currency → **Create workspace**.
3. **Settings → Load demo data.**
4. **Dashboard** — point out the numbers (with the seed you should see exactly —
   updated after the reliability audit, see `AUDIT_REPORT.md`):
   - Follow-ups due today **1**, Overdue **1**, Active leads **5**, Quotes sent **5**
   - Total quoted **$13,450.00**, Accepted **$320.00**, Lost **$4,800.00**
   - Win rate **50%** (1 won / 1 lost), Average quote **$2,690.00**
   - Next follow-ups list populated.
5. **Quotes** — open the **AC units** quote → **AI message** → Generate → show the
   **"Review and edit before sending"** banner, edit a word, **Copy message** →
   **Mark follow-up sent** (watch the count/next-date update).
6. **Follow-ups** — show **Due today / Overdue / Upcoming / Completed** all populated.
7. **Quotes** — on a quote hit **Won** (or **Lost**) → return to **Dashboard** to
   show win rate / accepted value update.
8. **Pipeline** — move a lead to another stage with the card menu.
9. **Settings → Export** — download **Quotes CSV**, open in a spreadsheet.
10. Close with the one-liner: _"Every quote you've sent is money on the table —
    QuotePilot makes sure you follow up and win more of them."_

## 5. Buyer-facing feature summary

- **Quote tracking** — leads and the quotes you send, with amount, status, notes.
- **Automatic follow-up reminders** — mark a quote sent, reminders are scheduled
  for you (your configurable schedule, e.g. day 1/3/7/14).
- **AI follow-up writer** — one click drafts a friendly, on-context message for 7
  situations (first/second/final follow-up, expiring quote, objection, lost-lead
  recovery, thank-you). **You review, edit, and send** — it never sends for you.
- **Message history** — every generated message is saved per quote.
- **Simple dashboard** — money quoted, accepted, lost, win rate, and what's due today.
- **Pipeline board** — leads grouped by stage, one-click stage changes.
- **CSV export** — leads, quotes, follow-ups.
- **Secure by design** — Supabase Auth + Row Level Security; a user only ever sees
  their own data.
- **Runs cheap** — Supabase free tier + optional pay-as-you-go AI (or free templates).

## 6. Screenshots / pages to capture

1. Landing page (hero).
2. Signup + Onboarding (workspace setup).
3. **Dashboard** with demo data (the numbers tell the story).
4. Leads list (search + status filter visible).
5. Quotes — a quote card showing amount, status, **Mark sent / Won / Lost**.
6. **AI message modal** — generated message + the "review before sending" banner +
   Copy + history (this is the wow shot).
7. Follow-ups page showing **all four sections** populated.
8. Pipeline board.
9. Settings — Export CSV + Demo data controls.
10. A **Quotes CSV** opened in Excel/Sheets.

## 7. Short launch checklist

- [ ] Create Supabase project; run `supabase/schema.sql`.
- [ ] Set `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (prod env too).
- [ ] (Optional) Set `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` for real AI.
- [ ] Auth → Email: decide on confirmation (off for demo, on for production).
- [ ] Deploy to Vercel (or `npm run build && npm start`).
- [ ] Run the demo script once end-to-end on the live project.
- [ ] Create two accounts and confirm account B sees none of account A's data.
- [ ] Export each CSV once and open it.
- [ ] Demo from the production build/deployment (not `next dev`).

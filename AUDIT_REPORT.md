# QuotePilot — Deep Debugging, Consistency & Reliability Audit

_Scope: find and fix real bugs, drift, security gaps and demo risks. No new
features, integrations or redesigns. Audited as a skeptical technical buyer._

---

## 1. Executive summary

| Question | Verdict |
| --- | --- |
| Demo-ready? | **Yes, after 2 setup steps** (re-run `schema.sql`, deploy this change) and one live run-through. |
| Safe for early beta? | **Not yet.** No password reset, no AI rate limit, no error monitoring, and the full flow has never been executed against the live Supabase project through the app. |
| Ready for paid users? | **No.** Multi-step writes aren't transactional, lists/exports silently cap at 1,000 rows, no security headers, no backups/terms. |
| Ready to pitch to a buyer? | **Yes, as an MVP asset** — with this report as the honest diligence pack. |

**Final recommendation: DEMO ONLY** (see §12).

The audit found **4 high-severity issues**, all now fixed:
1. **Cross-tenant data references.** RLS allowed a user's quote/follow-up/message to point at another tenant's lead or quote. Proven in Postgres: the victim deleting their own lead cascade-deleted the attacker's rows.
2. **The core loop broke via the edit form.** Draft → Sent in the form scheduled **no reminders**, and Won/Lost in the form left reminders "due" on closed deals.
3. **Every date showed one day early for US viewers.** `2026-01-01` displayed as "Dec 31, 2025".
4. **"Today" was computed on three different clocks.** The Dashboard and the Follow-ups page could disagree on what's due/overdue, and SSR mismatched the browser.

---

## 2. Commands run

| Command | Result | Important output |
| --- | --- | --- |
| `npm run build` (clean `.next`) | **PASS** | All 14 routes + middleware compile; type-check clean. |
| `npm start` (`next start -p 3021`) | **PASS** | Smoke test below; zero server-log errors. |
| `npm run lint` | **NON-FUNCTIONAL** | No ESLint config exists; `next lint` opens an interactive setup prompt and is deprecated in Next 15.5. Not fixed (would add tooling). |
| `npm run typecheck` / `npm test` | **DO NOT EXIST** | Not invented. `next build` performs the type-check. |
| RLS harness, **before** fix (`schema.sql` in PGlite, 2 users) | **11 pass / 6 fail** | 4 cross-tenant FK inserts/updates succeeded; cascade wiped the attacker's 2 quotes. (1 fail was a harness artifact: the row had already been cascaded away.) |
| RLS harness, **after** fix | **17 / 17 pass** | Cross-tenant refs blocked; reads/writes/spoofing blocked; cascades + CHECKs intact. |
| Date/CSV harness, **before** (real `lib/utils.ts`, `TZ=America/Los_Angeles`) | **8 / 13** | `2026-09-13` → "Sep 12, 2026"; `2026-01-01` → "Dec 31, 2025"; TAB/CR cells not neutralised. New York 9/13, UTC+5:30 11/13 (dates render correctly east of UTC, which is why the bug was invisible on the developer's machine). |
| Date/CSV harness, **after** (`TZ=America/New_York`) | **13 / 13** | |
| Logic harness (real seed → real `deriveQuoteFollowUpState` → real `computeDashboardMetrics`) | **42 / 42** in UTC−7 **and** UTC+5:30 | Seed counters == app recompute; dashboard == expected; dashboard buckets == Follow-ups page buckets. |
| Client bundle secret scan (`.next/static`) | **CLEAN** | Only hit: the Supabase SDK's own `sb_publishable_`/`sb_secret_` prefix check. No AI key names or AI endpoints in the browser. |
| Production smoke (`curl`) | **PASS** | `/`, `/login`, `/signup` → 200 · `/dashboard`, `/follow-ups` (logged out) → 307 `/login?redirect=…` · `/api/export/*`, `POST /api/generate-message` (logged out) → 401 · `POST /auth/signout` → 303. |

> Test harnesses live outside the repo (scratchpad). They used an embedded
> Postgres with Supabase's `auth.uid()` and `authenticated` role stubbed. They
> prove SQL/RLS semantics and pure logic, but not PostgREST or the live Supabase
> project — see §5.

---

## 3. Bugs found

| # | Severity | Location | Root cause | Impact | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | **High** (security) | `supabase/schema.sql`, `quotes/actions.ts` | Policies only checked the row's own `user_id`, never who owns the referenced lead/quote. Server trusted client `lead_id`. | Tenant B can attach quotes/reminders/messages to tenant A's lead/quote, or re-point a quote. When A deletes the lead, B's rows cascade away. Exploit needs A's UUID (not enumerable), but it's a tenant-integrity failure any diligence review flags. | **Fixed** (RLS reference checks + server ownership check) |
| 2 | **High** (core loop) | `updateQuote` | Status side effects existed only in the buttons, not the edit form. | Draft → Sent via the form: no reminders ever. Sent → Accepted via the form: pending reminders stayed "due" on a won deal (dashboard overdue counts wrong). | **Fixed** |
| 3 | **High** (demo) | `lib/utils.ts formatDate` | `new Date("YYYY-MM-DD")` is UTC midnight. | Every quote date, validity date and reminder date displays a day early for any viewer west of UTC, including every US buyer. Jan 1 displays the previous year. | **Fixed** (proven by harness) |
| 4 | **High** (consistency) | dashboard, `FollowUpsClient`, `QuotesClient`, `todayISO` | "Today" came from the server clock (UTC on Railway) on the dashboard but the browser clock on client components, which are also SSR'd with the server clock. | Dashboard vs Follow-ups page disagree on due/overdue for part of every day; "tomorrow/today" labels flip after hydration; hydration errors; "due today" flips at UTC midnight for everyone (5 pm in California, 10 am in Sydney). | **Fixed** (server-computed `today` in each viewer's own time zone) |
| 5 | Medium (security) | `AuthForm` | `?redirect=` accepted absolute URLs. | Open redirect: `…/login?redirect=https://evil.example` is a phishing vector. | **Fixed** |
| 6 | Medium (integrity) | `updateQuote` | Reminders/messages store `lead_id`; changing a quote's lead didn't move them. | Reminders show the wrong customer; deleting the old lead cascade-deletes the moved quote's reminders. | **Fixed** |
| 7 | Medium (reliability) | all pages, `(app)/layout`, onboarding | Query `error` ignored; `data ?? []`. | A DB hiccup shows "No leads yet" / all-zero dashboard (reads as data loss); a failed workspace query sent existing users back to onboarding. | **Fixed** (throw → error boundary; added root `app/error.tsx` because `(app)/error.tsx` can't catch its own layout) |
| 8 | Medium (reliability) | server actions | Write errors ignored. | Deletes/status changes/scheduling could silently no-op; seeding could half-load with no message. | **Fixed** |
| 9 | Medium (demo) | `lib/ai/provider.ts` | `fetch` had no timeout. | A slow provider (DeepSeek at peak) leaves the AI modal spinning indefinitely. | **Fixed** (25 s → template fallback) |
| 10 | Medium (demo/security) | provider + modal | Raw provider error body shown to users. | JSON error dumps (can include masked key fragments) on screen mid-demo. | **Fixed** (short, safe reason in the UI; details in server logs) |
| 11 | Medium (demo) | `logFollowUpSent` + modal | Result ignored; UI always showed success. | "Follow-up logged ✓" on a draft/no-reminder quote while nothing changed. | **Fixed** (honest message) |
| 12 | Medium (demo) | demo seed | Quotes hard-coded `USD`; message signed "QuotePilot Demo". | Non-USD workspace: "$780" on cards vs "€13,450" totals. | **Fixed** (uses business currency + owner name) |
| 13 | Medium (demo) | demo seed | `customer_name: "The Corner Bakery"`. | Template fallback greets **"Hi The,"**. | **Fixed** (customer is a person) |
| 14 | Medium (demo) | seed + `DataControls` | No guard, no feedback. | Repeat "Load demo data" silently doubles every record. | **Fixed** (loads only into an empty workspace; result shown) |
| 15 | Medium (cost) | `generate-message` route | Stored title/description passed to the AI unbounded. | One huge description = expensive calls on every generation. | **Fixed** (all AI inputs clipped) |
| 16 | Medium (consistency) | quote status flow | Mark sent moved the lead, but Won/Lost didn't. | Quote says Won, dashboard counts it, pipeline still shows "Negotiating". | **Fixed — behaviour change** (see §4) |
| 17 | Low (security) | `csvCell` | Injection guard missed TAB/CR prefixes. | CSV formula injection via crafted text. | **Fixed** |
| 18 | Low | export route | No UTF-8 BOM. | Excel shows "â€”" for "—" and garbles non-ASCII names. | **Fixed** |
| 19 | Low | export route | Query errors ignored. | Failed export downloads an empty CSV. | **Fixed** (500 + message) |
| 20 | Low | `markQuoteSent` | Always reset `quote_date`. | Moving a quote back to Sent erased its first-send date; AI "days since sent" reset to 0. | **Fixed** |
| 21 | Low | `scheduleFollowUps` | Numbering restarted at 1. | Duplicate "#1" next to a completed #1. | **Fixed** |
| 22 | Low | `markQuoteSent` | Not idempotent. | Double-click could double-schedule. | **Fixed** |
| 23 | Low (demo) | seed | Counter timestamps ≠ reminder rows; 100% win rate, $0 lost, empty New/Lost columns. | Numbers shift after the first click; demo looks fabricated. | **Fixed** (counters derived; realistic lost deal + new lead) |
| 24 | Low | dashboard | 0 decided quotes → "0%". | New account shows a 0% win rate. | **Fixed** (shows "—") |
| 25 | Low | dashboard | Greeting used server UTC hour. | "Good morning" in the afternoon for anyone east of UTC. | **Fixed** |
| 26 | Low | Supabase clients/middleware | Missing env → SDK throws on every request. | Landing page 500s with a cryptic error on a misconfigured deploy. | **Fixed** |
| 27 | Low (UX) | pipeline | `cold` has no column. | Moving a card to Cold makes it vanish silently. | **Fixed** (note + link; no new column) |
| 28 | Low | `createBusiness` | Unique violation surfaced raw. | Double-submit shows a Postgres error. | **Fixed** (treated as success) |
| 29 | Low | server actions | Client-supplied status/currency/days/dates trusted. | Garbage (e.g. 99999-day reminders, valid-until before quote date) accepted. | **Fixed** |
| 30 | Low (perf) | `getCurrentUser` | Session validated 2–3× per navigation. | Slower pages. | **Fixed** (memoised per request) |
| 31 | Low | `schema.sql` | Mutable `search_path` on trigger fn; per-row `auth.uid()`. | Supabase security/perf advisor warnings. | **Fixed** |
| 32 | Info | `package.json` | `npm run lint` unusable. | — | Documented |
| 33 | Info | README | Said "five" deps (six); Vercel-only deploy docs. | — | **Fixed** |

---

## 4. Fixes implemented

**New files**
- `lib/follow-up-state.ts` — the single definition of follow-up counters (`deriveQuoteFollowUpState`), reminder numbering, and due-today/overdue buckets (`classifyFollowUp`).
- `lib/quote-state.ts` — the single write path for quote status changes (`applyQuoteStatusChange`): schedule/skip reminders, sync lead stage, recompute counters.
- `lib/metrics.ts` — the dashboard formula as a pure function.
- `lib/demo-seed.ts` — seed as pure data; counters derived with the app's own function.
- `lib/supabase/env.ts` — clear missing-config errors.
- `app/error.tsx` — root error boundary (catches app-shell/layout failures).

**Modified**
- `supabase/schema.sql` — reference-ownership checks in quotes/follow-ups/messages policies; `(select auth.uid())`; `search_path` pinned.
- `app/(app)/quotes/actions.ts` — lead-ownership check, all transitions via `applyQuoteStatusChange`, lead-change sync, idempotent Mark sent, first-send date preserved, honest `logFollowUpSent`, input validation.
- `app/(app)/follow-ups/actions.ts` — shared recompute; no-op on unchanged state; errors surfaced.
- `app/(app)/settings/actions.ts` — seed guard/currency/errors; `clearAllData` returns results; validation; idempotent onboarding.
- `app/(app)/leads/actions.ts` — status validation, errors surfaced.
- `app/api/generate-message/route.ts` — input clipping, safe errors, `historySaved` flag.
- `app/api/export/[type]/route.ts` — BOM, error handling, `message_sent` column (the final edited text, previously stored but never visible).
- `lib/utils.ts` — `formatDate` date-only fix, `todayISO`/`currentHour` take an explicit time zone (resolved per request in `lib/request-time.ts`), `relativeDay(date, today)`, CSV TAB/CR, `clip`.
- `lib/ai/provider.ts` — timeout, sanitized reasons, server-side error logging.
- `lib/supabase/server.ts` / `client.ts` / `middleware.ts` — env guard, memoised `getCurrentUser`, `requireUser`.
- All `(app)` pages + layout + onboarding — throw on query errors, `requireUser`, pass server `today`.
- `components/auth/AuthForm.tsx` (safe redirect), `components/follow-ups/FollowUpsClient.tsx` / `components/quotes/QuotesClient.tsx` (server `today`, shared classifier), `components/ai/AIMessageModal.tsx` (honest log result, safe notice), `components/DataControls.tsx` (result messages), `components/pipeline/PipelineClient.tsx` (cold note), `components/quotes/QuoteFormModal.tsx` (accurate hint).
- Docs: `README.md`, `.env.local.example`, `QA_REPORT.md` (new expected numbers).

**Behaviour changes a reviewer should know about (deliberate, not silent)**

| Before | After | Why |
| --- | --- | --- |
| Quote Won/Lost left the lead's stage alone | Accepted → lead **won**; Rejected → lead **lost** only if the lead has no other open/won quote | Mark sent already synced the lead; outcome was contradicting itself across screens. Reverting a quote does **not** revert the lead. |
| "Load demo data" stacked copies | Loads only into an empty workspace | Prevents duplicated demo records. |
| Demo: 5 leads, 5 quotes, 100% win rate | 7 leads, 6 quotes (added a lost cleaning contract + a new electrical lead) | $0 "Lost value" and 100% win rate read as fake; every pipeline column now has a card. |
| Win rate "0%" with nothing decided | "—" with "No quotes won or lost yet" | 0% is a claim the data doesn't support. |

**Verification:** RLS harness 17/17, date/CSV harness 13/13 (US tz), logic harness 42/42 (UTC−7 and UTC+5:30), clean `npm run build`, production smoke test, bundle scan.

---

## 5. Remaining known issues

### Must fix before a user demo (setup — no code)
1. **Re-run `supabase/schema.sql`** in the live Supabase SQL editor. The RLS hardening isn't active until you do (the server-side lead check already protects the app's own paths). The file is idempotent.
2. _(Optional)_ **`APP_TIMEZONE`** on Railway is only a deployment fallback. Dates follow each viewer's browser time zone. Leave it unset or `UTC` for a global deployment.
3. **Deploy this change** (commit + push → Railway auto-deploys).
4. **Run the demo script once on the live URL**, and create a second account to confirm it sees none of the first's data. This is the one thing never executed end-to-end through the app against the real Supabase.
5. Supabase → Auth → Email: turn **off** "Confirm email" for the demo.

### Must fix before beta
- **No password reset** — a locked-out user needs a manual reset in the Supabase dashboard.
- **Email confirmation lands logged-out.** There's no `/auth/callback` route, so the link verifies the email but drops the user on the landing page (the UI already tells them to log in after).
- **No rate limit / quota on the AI endpoint** — any signed-up user can generate without limit (cost exposure; small with DeepSeek, unbounded in principle).
- **No error monitoring** — failures only appear in Railway logs.
- **No length limits on text fields** (DB `text` is unbounded; AI input is clipped).
- **Quote status "Follow-Up Due" is manual only.** Nothing sets it automatically; reminders drive the Follow-ups page. The label can mislead.

### Must fix before paid launch
- **Multi-step writes aren't transactional.** A status change is several requests, so a mid-way failure can leave e.g. "Sent" with no reminders (counters self-heal on the next reminder action). Move these into Postgres functions (RPC).
- **1,000-row cap.** Supabase returns at most 1,000 rows by default, so lists and **CSV exports silently truncate** beyond that. Needs pagination.
- Security headers/CSP, backups & retention, account deletion, terms/privacy, CI with real lint + tests (the harnesses here are ad-hoc).
- Multi-currency totals (no FX conversion).

### Acceptable MVP limitations
- One workspace per user; manual sending; client-side search.
- `cold` leads aren't on the board (the UI now says so).
- The demo seed mixes service types to show range, and its amounts are sized for USD-like currencies (they look small in currencies such as INR or JPY).
- Message history stores generated drafts. The edited text you actually mark as sent is stored on the reminder and exported as `message_sent`.
- CSV formula protection prefixes `'` to cells like `+1 555…`, which some spreadsheet apps display.
- Reopening a skipped reminder on a closed quote makes it due again (user-initiated).
- `next dev` shows a Next.js dev-overlay warning — demo from production.

---

## 6. Data consistency audit

**Quote ↔ follow-up synchronisation.** One source of truth: the reminder rows. `follow_up_count`, `last_follow_up_at` and `next_follow_up_at` are **never incremented** anywhere; every path calls `recomputeQuoteFollowUpState` → `deriveQuoteFollowUpState`. The paths are Mark follow-up sent, complete, skip, reopen, schedule, and every status change. `grep follow_up_count` confirms no other writers. Re-audit of the previous QA fix: it was correct, but the recompute existed twice (drift risk). It's now consolidated.

**Status transitions.** The buttons, dropdown, edit form and creation all funnel into `applyQuoteStatusChange`:
- → Sent: schedules reminders.
- → Accepted/Rejected/Expired: skips pending reminders.
- Every transition syncs the lead's stage, then recomputes the counters.

Result: a closed quote can no longer have pending reminders counted as due.

**Dashboard formula** (`lib/metrics.ts`), verified by executing it on the seed:

| Metric | Definition | Seed value |
| --- | --- | --- |
| Active leads | status ∈ new, contacted, quote_sent, follow_up_due, negotiating | **5** |
| Quotes sent | status ≠ draft (includes won/lost/expired) | **5** |
| Total quoted | Σ amount of quotes sent | **$13,450.00** |
| Accepted value | Σ accepted | **$320.00** |
| Lost value | Σ rejected (expired is *not* lost) | **$4,800.00** |
| Win rate | won ÷ (won + lost); "—" if none decided | **50%** (1/1) |
| Average quote | total quoted ÷ quotes sent | **$2,690.00** |
| Due today / Overdue | shared `classifyFollowUp` on pending reminders, server "today" | **1 / 1** |

**Follow-ups page:** Due today 1 · Overdue 1 · Upcoming 2 · Completed & skipped 8. These use the same classifier as the dashboard, which the harness asserts.

**Lead ↔ quote ↔ pipeline.** The pipeline is lead-driven; quote outcomes now push the lead stage (§4). The seed's lead stages match their quotes (Dana won ↔ accepted, Sofia lost ↔ rejected).

**Demo seed.** Every quote's counters equal what the app's own recompute would store (6/6). All enums are valid. Every reference resolves. There's no wedding/event wording, and every customer name is a person.

---

## 7. Security / RLS audit

- **Tables:** `businesses`, `leads`, `quotes`, `follow_ups`, `messages`. RLS is enabled on all of them, with one `for all to authenticated` policy each and no `anon` policies.
- **Policies:**
  - `USING (select auth.uid()) = user_id` on every table.
  - `WITH CHECK` also requires the referenced `leads`/`quotes` rows to belong to the caller.
  - `messages.lead_id` may be null.
- **Server scoping:** every query and mutation adds `.eq("user_id", user.id)` (defence in depth). Inserts set `user_id` from the verified session, never from the client. Quote writes verify lead ownership. Route handlers check auth before any work. Server-action arguments (IDs, statuses) are validated.
- **Verified (Postgres, 2 users):**
  - B can't read, update, delete or spoof A's rows.
  - B can't transfer rows to A.
  - B can't reference A's lead/quote from a quote, reminder or message.
  - Anon sees nothing.
  - Deleting a lead cascades correctly.
  - One workspace per user.
  - Invalid statuses are rejected.
- **Other:** no `service_role` key anywhere; AI keys are server-only (bundle scan clean); no `dangerouslySetInnerHTML` (all user and AI text renders escaped); the open redirect is fixed.
- **Residual:** the two-account test must still be run **against the live Supabase through the app** after the schema re-run (§5.1). The AI endpoint has no rate limit. Signout has no CSRF token (worst case: a forced logout).

---

## 8. AI audit

- **Provider order:** Anthropic → DeepSeek → OpenAI-compatible → template.
- **Timeout:** 25 s per call.
- **Fallbacks:** any failure (HTTP error, timeout, empty reply) returns the template, flagged `fellBack`. The UI shows a short, safe reason ("API key was rejected", "request timed out"), and the full error goes to server logs.
- **Prompt safety:** the system prompt forbids invented facts, discounts and dates. Internal quote notes are **not** sent to the AI. All inputs are clipped (title 200, description 1,500, names 80–120, context 500). Prompt injection via customer text can at worst produce an odd draft, which the user reviews.
- **Human-in-the-loop:**
  - Nothing is ever sent. The output lands in an editable textarea under a persistent "Review and edit before sending" banner.
  - Copy uses the current (edited) text.
  - Generating or copying never changes follow-up state; only the explicit **Mark follow-up sent** does, and it now reports honestly when there's nothing to log.
- **History:** every generated draft is saved per quote (scoped to user and quote). The final edited text is stored on the completed reminder and exported. If saving history fails, the user is told.
- **Gap:** no per-user rate limit or quota (§5).

---

## 9. Deployment readiness

- **Env vars:**
  - Required: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Both are **inlined at build time**, so redeploy after changing them.
  - Optional: `APP_TIMEZONE` (deployment fallback, default `UTC`; not a business setting).
  - AI (one of): `DEEPSEEK_API_KEY` (current), `ANTHROPIC_API_KEY`, or `OPENAI_API_KEY` (+ `OPENAI_BASE_URL`). Optional `AI_MODEL`.
  - A missing Supabase config now gives a clear error instead of crashing the landing page.
- **Build/start:** `npm run build` and `npm start` both pass. `next start` binds Railway's `$PORT`. Node is pinned to ≥ 20 (`engines` + `.nvmrc`).
- **Railway:** Deploy from GitHub; set the variables before the first build; generate a domain; set Supabase **Site URL** to it. Vercel works identically.
- **Setup risks:** forgetting to re-run `schema.sql`, or leaving email confirmation on during a demo.

---

## Addendum — global-readiness pass

The product had no hard-coded country default. However, `APP_TIMEZONE` was one
app-wide clock: setting it to any single zone would have given every user
worldwide that zone's "today".

Dates now follow each **viewer's browser time zone**. A small client component
(`components/TimezoneCookie.tsx`) shares it with the server via a cookie, and
`lib/request-time.ts` resolves the zone per request, with `APP_TIMEZONE` as the
fallback and then UTC. All classification stays server-side, so pages still agree.

Other changes in this pass:
- Currency list adds NZD, CHF, SEK, NOK, DKK and PLN.
- The dashboard's `$` icon is replaced with a currency-neutral one.
- The phone placeholder asks for a country code.
- The AI prompt is channel-neutral.
- A US street reference was removed from the seed.
- Docs no longer imply any single market.

**Remaining:** there's no stored per-business time zone. That's fine for
single-user, browser-driven use; add one before email/SMS reminders or teams.

---

## 10. Buyer-demo script (90 seconds)

_Production URL, fresh account, email confirmation off._

1. **(10s)** Landing → **Get started** → sign up → onboarding (name, industry, currency) → **Create workspace**.
2. **(10s)** **Settings → Load demo data** → "Demo data loaded".
3. **(15s)** **Dashboard:** "1 follow-up due today, 1 overdue, $13,450 quoted, $4,800 lost, 50% win rate — this is the money sitting in your quotes."
4. **(25s)** **Quotes → AC units → AI message → Generate.** Point at the review banner, edit a word, **Copy message**, **Mark follow-up sent**. Follow-ups sent goes 1 → 2 and "Next follow-up" moves to "in 4 days".
5. **(10s)** **Follow-ups:** Due today / Overdue / Upcoming / Completed are all populated. The overdue sign quote is a perfect "Quote expiring" nudge.
6. **(10s)** **Quotes → Living + dining redesign → Won.** The Dashboard win rate goes to 67% and accepted value to $5,720.
7. **(5s)** **Pipeline:** Priya has moved to **Won** automatically.
8. **(5s)** **Settings → Quotes CSV** → it opens cleanly in Excel.

Close: _"Every quote you've sent is money on the table. QuotePilot makes sure you follow up — and you always review before anything goes out."_

---

## 11. Screenshots to capture

| # | Screen | What it proves |
| --- | --- | --- |
| 1 | Landing hero | Clear positioning for service businesses |
| 2 | Onboarding | One-minute setup, one workspace per user |
| 3 | Dashboard (demo data) | Money-at-risk view; numbers are coherent (13,450 / 320 / 4,800 / 50%) |
| 4 | Quote card (AC units) | Amount, status, correct dates, follow-up count, next follow-up |
| 5 | AI modal after Generate | Editable draft, review banner, copy, history — the "wow" shot |
| 6 | AI modal after Mark follow-up sent | "Follow-up logged" + counter update (human-in-the-loop) |
| 7 | Follow-ups page | All four sections populated and consistent with the dashboard |
| 8 | Pipeline | Every stage populated; won deal in Won |
| 9 | Settings → Demo data result | Guarded loader with a clear success message |
| 10 | Quotes CSV in Excel | Clean UTF-8, safe cells, `message_sent` column in the follow-ups export |
| 11 | Second account's empty dashboard | Tenant isolation (after the schema re-run) |

---

## 12. Final recommendation

### **DEMO ONLY** — safe for a buyer/user demo, not yet a beta.

The code-level issues that would embarrass a demo or fail diligence are fixed and verified:
- cross-tenant references
- the broken edit-form loop
- off-by-one dates
- clock drift
- silent failures
- open redirect
- AI hangs and raw errors
- duplicate or implausible demo data

It is **not** beta-ready because the full flow has not yet been executed end-to-end against the live Supabase project, and there's no password reset, AI rate limit or error monitoring.

It moves to **BETA READY** (small invited group) once the §5 demo steps pass on the live deployment and password reset + an AI rate limit are in place.

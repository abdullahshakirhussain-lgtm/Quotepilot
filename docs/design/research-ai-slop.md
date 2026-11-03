# What reads as "AI slop" in interface design — research notes

Compiled 2026-11-02 for the QuoteLoop redesign brief. Every point below comes from a
source that was read in full (not from search snippets). Where sources disagree, the
disagreement is noted. Statistics quoted by vendors were not verified and are left out.

## Sources read

**Primary / authoritative**
- Anthropic, `frontend-design` skill (current SKILL.md) — https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md
- Anthropic, "Improving frontend design through Skills" (Nov 12 2025) — https://www.claude.com/blog/improving-frontend-design-through-skills
- Anthropic cookbook, "Prompting for frontend aesthetics" — https://github.com/anthropics/claude-cookbooks/blob/main/coding/prompting_for_frontend_aesthetics.ipynb
- GOV.UK Design System: error message, error summary, validation, notification banner, confirmation pages — https://design-system.service.gov.uk/
- Atlassian Design: empty state, error messages, flag usage — https://atlassian.design/foundations/content/designing-messages/
- Nielsen Norman Group: error-message guidelines; confirmation dialogs; the sparkles icon problem — https://www.nngroup.com/articles/error-message-guidelines/ · https://www.nngroup.com/articles/confirmation-dialog/ · https://www.nngroup.com/articles/ai-sparkles-icon-problem/
- Wikipedia, "Signs of AI writing" — https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing

**Catalogues and critiques**
- "Signs of AI design" field guide (97 signs + design-rules.md) — https://github.com/febbhav/signs-of-ai-design
- Impeccable slop catalogue (68 entries, 62 detector rules) — https://impeccable.style/slop
- 925 Studios (two guides), Illos checklist, SmoothUI, prg.sh, Plainify, SCALR "20 signs", TeneX "8 signs", aitoolpick 30-point checklist
- App/dashboard-specific: uxskill "Why AI-generated dashboards all look the same", gendesigns "15 mistakes", AskCodi "The AI UI problem nobody talks about"

Failed to load (not used): ACM "Looks Good, But Is It Usable?" (403), a Medium dashboard-skill article (403), Shopify Polaris pages (socket closed).

## The underlying cause (all sources agree)
Unspecified decisions fall to the median of training data: Tailwind/shadcn/Lucide/Framer
defaults emitted verbatim. "The defaults are fine; unmodified defaults at scale become a
signature." The fix every source gives: a binding written spec — tokens, what the UI must
include, what it must **not** include, tone, density — plus a self-critique pass against it.
One sign proves nothing; stacked signs are the signature. Judge the *absence of decisions*.

## Visual tells (with the agreed alternative)

### Colour
- Purple/indigo/violet gradients or accents (Tailwind indigo-500 #6366F1, violet-500 #8B5CF6) — named by 7 of 8 critique pages. → Palette from the product; one committed accent used for action.
- Second-wave defaults once purple is banned: warm cream/beige "tasteful" surface (~#F4F1EA) with terracotta/clay accent (~#D97757, Anthropic's own accent); emerald (#10B981) fallback; near-black with a single acid-green/vermilion/neon accent and glow. → Don't swap one default for the next.
- Gradient text on headings or big numbers (bg-clip-text). → Solid colour; emphasis by size/weight/words.
- Timid, evenly weighted palette; alternating #f5f5f5/#fafafa section backgrounds. → One dominant neutral, one real accent, semantic colours only for state.
- Ambient glows, radial halos, blurred blobs/orbs, aurora backgrounds, grain overlays, decorative grid-line backgrounds, repeating stripes.
- Gray text on coloured backgrounds; low-contrast "dark mode" (mid-gray on slightly-less-mid-gray).

### Typography
- Inter / Roboto / Arial / Open Sans / Lato / system sans as the unchosen only face; Geist (v0), Space Grotesk (the "escape Inter" reflex), Instrument Serif.
- Oversized italic serif hero headline, or a single italic/coloured accent word in a headline.
- Tracked ALL-CAPS eyebrow label above headings ("FEATURES"); a pill badge above the headline ("New", "AI-powered").
- Flat hierarchy (sizes too close), crushed letter-spacing on display type, monospace used as decoration for small data labels.
- Title Case Everything. → Sentence case, chosen deliberately.
- Line length > ~75–80 characters; widows; tight line height; tiny interface text.

### Layout & surfaces
- The "SaaS card kit": everything chopped into identical rounded cards, one radius everywhere (rounded-2xl 16–24px), the same rgba(0,0,0,.1) soft shadow under each.
- Ghost card: hairline border AND wide diffuse shadow on the same element. → Commit to one edge treatment.
- Coloured left-border accent stripe on ordinary cards. → Reserve for real alerts.
- Cards inside cards. → Flatten with spacing, type and dividers.
- Glassmorphism without a real layering problem.
- Three (or six) identical icon+heading+two-line cards; bento grids as the "escape"; icon in a tinted rounded square stacked above a heading.
- Numbered markers 01/02/03 when the content isn't a sequence.
- Monotonous spacing (one gap everywhere) or arbitrary spacing (18/22/30/44). → One scale, e.g. 4·8·12·16·24·32·48·64, "and nothing between".
- Everything centred.
- Meta strings joined with middle dots ("A · B · C"); "WORD — fragment" labels; "→" appended to every button/link.

### App / dashboard specifically
- The "dashboard centroid": left sidebar of rounded icon buttons + top bar with search, bell and avatar pill + a row of four stat cards (big number, tiny label, green/red delta) + one full-width line chart + a zebra table, all with landing-page airiness and a violet primary.
- Landing-page spacing on data-dense screens (16–24px gaps where 4–8px serve); screens showing a tenth of what they could hold. → Treat density as a decision; tighter base for working screens.
- Hero-metric layout used by reflex; chart monoculture; gradient fills under lines; drop shadows on data cards.
- Unrequested chrome: avatar menus, notification bells, search bars, settings cogs that do nothing.
- Placeholder content ("Item 1", "User Name", lorem); invented numbers.

### Icons & imagery
- The "Lucide five" reused for unrelated meanings: Sparkles (AI), Zap (fast), Shield (secure), Check, BarChart3, ArrowRight on every CTA.
- ✨ Sparkles for AI: NN/g found **no participant** associated it with AI; 73% read a star-like icon as save/favourite. → Use a text label; don't rely on the icon.
- Emoji as icons or heading prefixes.
- Fake terminal/code window hero for non-developer products; plastic 3D blobs; generic circle-and-block illustrations; generated headshots.

### Motion
- The same fade-up on every section; hover lift on every card; bounce/elastic easing; pulsing status dots; blinking cursors; marquees; cursor-follow glows; opacity-only hovers.
- → Motion only to answer an action (open, expand, confirm, show what changed); respect reduced motion.

### Copy (the half that's usually missed)
- Weightless headlines that fit any product ("Build faster. Ship smarter.", "Your all-in-one platform").
- Buzzword layer: unlock, unleash, empower, seamless, supercharge, streamline, elevate, leverage, robust, cutting-edge, world-class, best-in-class, effortless, harness, delve, "in today's fast-paced world".
- Em dashes several times the human rate; negative parallelism ("It's not just X — it's Y"); rule-of-three cadence; aphorism closing every section; FAQ paraphrasing the page.
- Generic CTAs ("Get started", "Learn more", "Submit", "OK"). → The button says exactly what happens; the same verb carries through ("Publish" → "Published").
- Chatbot residue in UI text: "Oops!", "Something went wrong" with no cause, "Please", "Sorry", "Are you sure?".
- Fabricated trust: invented user counts, logo walls, testimonials from people who don't exist, compliance badges.

## Interface states — authoritative rules (GOV.UK, Atlassian, NN/g)
- **Errors** say what went wrong and how to fix it, next to the cause, in plain words. No "invalid", "illegal", "incorrect", "forbidden", "oops", codes, "please" or "sorry" (except a total failure). Specific per cause: empty → instruction ("Enter your email"); format/length → description ("Name must be 35 characters or less"). Keep the user's input. Never colour alone. If the cause is unknown, don't invent one — say so and give a next step. Don't blame the user ("we're having trouble connecting", not "you're having connection issues").
- **Validation** on submit, not on blur or while typing; always on the server; summary of all errors at the top with focus moved to it for multi-field forms.
- **Empty states**: distinguish first-use (blank slate), cleared/finished, and no-results-for-filter. Title few words, sentence case; body = reason + next step in 1–2 sentences; one imperative CTA. Frequent messages concise; delight only where rare.
- **Success**: confirm the outcome and let people continue; if something was created, offer a way to view it; same heading wording across the product; remove on navigation; never auto-dismiss anything critical; never the only place important information lives.
- **End of a journey** (e.g. payment): a confirmation moment with what happened, what happens next and when, how to get a record, and how to get help.
- **Confirmation dialogs** only for serious or irreversible actions; name the object and consequence; buttons describe outcomes ("Delete 12 quotes" / "Keep them"), never Yes/No; no default yes; type-to-confirm only for the most dangerous; prefer undo.
- **Loading**: skeletons that match the real layout over spinners for content; spinners only inside the control that's busy; always a retry path on failure.
- **Accessibility floor**: WCAG AA (4.5:1 text, 3:1 large/UI), visible keyboard focus, 44px touch targets on mobile, reduced motion respected, labelled controls, no colour-only meaning, heading levels in order.

## Process that works (Anthropic skill + critiques)
1. Ground the design in the subject: industry, materials, vernacular, real content.
2. Plan first: 4–6 named hex colours, typefaces and roles, a layout concept (ASCII wireframes), alignment, principles.
3. Review the plan against "what would I produce for any similar product?" — revise anything generic and say what changed.
4. Spend boldness in one place; keep the rest quiet. "Remove one accessory."
5. Build to a quality floor; screenshot and critique every state, not just every screen; audit radii/shadows/gaps/sizes (a value used once is usually a mistake).

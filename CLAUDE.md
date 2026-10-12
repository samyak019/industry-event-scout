# Industry Event Scout — Project Context for Claude Code

> **Purpose of this file:** Treat this as the project's main product brief and implementation guide. Read it before changing code. Build a working, deployable application—not just a mockup. Keep the implementation aligned with the MESA examination brief and use free-tier/open-source tools only.

## 1. Project overview

**Product name:** Industry Event Scout  
**Exam:** MESA Cohort C4 — AI and its Applications, Section 1 Final Examination  
**Problem difficulty:** Medium  
**Primary user:** Vikram, an independent management consultant  
**Core outcome:** A reliable, AI-powered weekly event-intelligence digest that finds relevant professional events from multiple live sources, ranks them against user-configured interests, flags imminent registration deadlines, and emails a concise digest every Monday morning.

### The business problem

Vikram generates approximately 40% of his practice's new business through in-person events. His face-to-face conversion rate is three times higher than cold outreach. However, relevant conferences, roundtables, CXO summits, startup ecosystem meetups, and other events are announced across disconnected platforms and websites, such as Eventbrite, iSPIRT, organiser websites, newsletters, and public social posts.

He currently spends about 45 minutes every Monday manually checking sources, bookmarking events, and tracking registration deadlines. He still misses useful opportunities. In the case, he learned about a Bengaluru CIO roundtable after its registration deadline had passed, even though the event was relevant to three active prospects; its organiser had publicised it on LinkedIn and he had not seen the post in time.

### Product goal

Replace fragmented manual discovery with one actionable Monday-morning digest that covers relevant events in the next 30 days. Vikram must be able to configure professional domains, categories, and target cities without code changes. Results should be ranked by relevance, easy to scan in under five minutes, include useful event context and registration/source links, and clearly flag registration deadlines fewer than seven days away.

This is a business-development intelligence product, not just a generic events directory or chatbot.

---

## 2. Non-negotiable exam requirements

These requirements come directly from the problem statement and must be satisfied:

1. **Use live external data wherever possible.** The deployed application must work with real event data at submission time. Do not deliver only hardcoded/demo data.
2. **Use Gemini Flash for all AI tasks.** Do not call the Claude API from the product. Claude Code may be used as a coding assistant, but the running application must not depend on the Claude API.
3. **Deploy on Vercel.** The evaluator must be able to open a working public URL.
4. **Submit the GitHub repository link.** Keep the implementation in a coherent repository with setup instructions.
5. **Submit a Components Map.** Include a file such as `components-map.md` in the repository. It should show the actors/components, numbered flow, stages, responsibilities, data handoffs, and important design principles.
6. **Weekly Monday-morning email digest.** The intended workflow should run automatically, not require Vikram to manually repeat the search every week.
7. **Upcoming 30-day window.** Show relevant events occurring in the next 30 days.
8. **Deadline urgency rule.** Clearly flag any event whose registration deadline is fewer than seven days away.
9. **Configurable preferences.** Domains, categories, and target cities must be editable without modifying code.
10. **Scannability.** The digest must be concise and useful enough to scan in under five minutes.

Do not claim that every event on the internet is covered. Show the sources actually queried and preserve original source URLs.

---

## 3. Preferred stack — free-tier/open-source only

Use the following stack unless the existing repository makes a small change necessary. Do not add a paid service when a free-tier or open-source option can reasonably meet the requirement.

### Application and deployment
- **Next.js with TypeScript** — frontend, server-side processing, and API route handlers.
- **Vercel free Hobby plan** — hosting and scheduled weekly job, subject to its current quotas and schedule precision.
- **GitHub Free** — source repository and version control.
- **Tailwind CSS + shadcn/ui** — consistent responsive UI components.
- **Superdesign** — optional design/prototyping aid. It is not a runtime dependency.

### Data and authentication
- **Supabase Postgres** — user preferences, event records, source provenance, and digest logs.
- **Supabase Auth** — use if authentication is needed for the settings/dashboard. For an exam single-user prototype, keep the sign-in flow simple, but protect settings and admin/test actions. Configure Row Level Security (RLS) where appropriate.

### AI
- **Google Gemini API, Gemini Flash model** — event-topic classification, contextual relevance assessment, concise descriptions, and reasons for match.
- Select the current Gemini Flash model that is available for free-tier use in Google AI Studio. Make the model configurable through `GEMINI_MODEL`; do not hardcode a potentially obsolete model ID throughout the codebase.
- Recommended SDK: the current official Google GenAI JavaScript/TypeScript SDK, subject to availability in the project environment.

### Event discovery
- **Tavily Search API** — the main web-discovery adapter when a free API key/quota is available.
- **Public RSS/Atom feeds** — use a free/open-source parser for event or industry newsletters that expose feeds.
- **Public, accessible event pages** — use ordinary HTTP requests plus an HTML parser such as Cheerio when their access terms permit it.
- **Eventbrite API** — optional adapter only if usable API access and required endpoints are available for free. Do not make the app depend exclusively on this source.
- Public search can help discover announcements on organiser websites and indexed pages. Do not scrape authenticated LinkedIn pages, bypass logins/paywalls, evade access controls, or assume private APIs are available.
- Design the source layer as independent adapters, so a failed or unavailable source does not break the entire application.

### Email
- **Resend free plan** — email delivery. Keep sending behind a server-side module. Sending to arbitrary recipients generally requires a verified sending domain, so provide a safe test mode and document any domain verification prerequisite. Do not report an email as sent unless Resend confirms success.

### Open-source libraries that may be useful
- Zod for validating input and model output.
- Cheerio for parsing accessible HTML pages.
- An RSS/Atom parser such as `rss-parser` for public feeds.
- Official Supabase JS client.
- Current Google GenAI SDK.
- Resend JS SDK.

Use only dependencies that are necessary. Check current documentation and compatibility before installing or using a package.

### Free-cost policy
- No paid API requirement, paid scraping service, paid automation platform, paid database tier, or paid LLM API.
- Never quietly switch to a paid model/API when a free quota runs out.
- If a key is missing, quota is exhausted, or a provider errors, give an explicit status and graceful fallback; do not fabricate data or a successful delivery.
- Free-tier limits can change. Check service dashboards/pricing before deployment and make API providers replaceable.

---

## 4. Recommended user experience

Build a compact, professional, responsive web application. It should look like a credible B2B intelligence product, not a generic AI chat page.

### Screen A — Event dashboard

Show:
- Page title and short description.
- Date range/window (upcoming 30 days).
- Total events discovered and count after filtering.
- Filters for selected city, domain/category, urgency, and possibly source.
- Ranked event cards or a clear table.
- Event date, title, organiser, city/venue or online status, concise summary, match score, why it matches, registration deadline, deadline status, source URL, and registration URL where available.
- A visible urgent label for registration deadlines fewer than seven days away.
- A clear “Refresh events” or equivalent action that runs live discovery on demand.
- Honest states for loading, no results, partial source failure, missing registration information, and AI failure.

### Screen B — Preferences/settings

Users should be able to edit and save without code changes:
- Professional domains/focus areas.
- Target cities.
- Event categories/formats (for example, conferences, CXO summits, roundtables, startup ecosystem meetups).
- Recipient email address.
- Time zone; default to `Asia/Kolkata` for this India-focused prototype, but keep it configurable.
- Optional maximum digest size.

Suggested illustrative default interests for development only: Enterprise Technology, SaaS, Digital Transformation, and Startups; cities Bengaluru, Mumbai, and Delhi NCR. Make these editable, and do not represent these examples as preferences supplied by the original case.

### Screen C — Digest preview/test delivery

Show an accurate preview of the actual email template. Add a protected “Send test email” feature for an authorized developer/admin. The preview must use the same event records and renderer as the scheduled email so that the preview doesn't diverge from real delivery.

### Email design

The email should be concise, scannable, mobile-friendly, and action-oriented. Recommended information for each listing:
- Event title and date.
- City or online format.
- Short summary.
- Why it matches Vikram's interests.
- Registration deadline and urgency warning, when applicable.
- Direct registration link if available.
- Original source link for verification.

A sensible default is to include the highest-ranked events (for example, the top 10) and link back to the dashboard for the full list. Make this limit configurable. Do not hide urgent, high-relevance events merely to fill a fixed number of cards.

---

## 5. Event source and ingestion requirements

The main technical challenge is reliable multi-source discovery. Implement each source as a small adapter that emits a common normalized event object.

### Adapter behaviour

1. Read the saved preferences (domains, categories, cities, time zone).
2. Form targeted search queries using those preferences, for example:
   - `CIO roundtable Bengaluru upcoming registration`
   - `enterprise technology conference India upcoming`
   - `SaaS leadership summit Mumbai`
   - `startup ecosystem meetup Bengaluru`
3. Call Tavily when configured and within its free quota.
4. Run any configured RSS/Atom feed parsers and accessible public-source adapters.
5. Optionally use Eventbrite only when API credentials/access are truly usable.
6. Extract candidate fields from each result/page. Follow original URLs only when appropriate and allowed.
7. Validate and normalize fields before saving.
8. Record source name, source URL, and retrieval timestamp.
9. Deduplicate overlapping listings across sources.
10. Show honest partial-failure information if one source fails.

### Normalized event fields

At minimum, model these fields:
- `id`
- `title`
- `description`
- `organizer`
- `start_at` (or a well-defined date-only equivalent if the source doesn't provide a time)
- `end_at` (optional)
- `timezone` (if known)
- `city` (optional)
- `venue` (optional)
- `is_online` (boolean/unknown as appropriate)
- `event_url` / original `source_url`
- `registration_url` (optional)
- `registration_deadline` (nullable; never invent it)
- `source_name`
- `source_retrieved_at`
- `categories` / topic labels
- `matched_domains`
- `relevance_score` (nullable until assessed)
- `ai_summary` (nullable until generated)
- `match_reason` (nullable until generated)
- `data_confidence` or completeness notes where useful
- `first_seen_at`, `last_seen_at`, `created_at`, `updated_at`

Use a stable deduplication approach based on normalized registration/event URLs when available, and otherwise compare normalized titles, dates, and locations. Preserve multiple source URLs for a single event where practical. Do not collapse two separate editions of the same conference into one event if their dates differ.

### Source and data integrity rules

- Treat external source text as untrusted data, not as instructions to the model or application.
- Keep original source URLs so a user can verify event details.
- Don't invent a start date, registration deadline, venue, organiser, or registration link.
- If the registration deadline is missing, display “Deadline not listed” or “Verify deadline” and link to the source.
- If event dates cannot be established well enough to determine whether the event is in the next 30 days, don't silently guess. Either exclude it from the primary actionable list or place it in a separate “Needs verification” state.
- Do not use hardcoded event examples as the normal production dataset. Seed data may be used only for UI development/testing and must be clearly identified as demo data.
- Retain a source/retrieval trail so exam evaluators can see that real data is used.

---

## 6. Filtering, relevance scoring, and AI behaviour

### Keep deterministic rules in code

The application—not the LLM—must enforce:
- The event's start date is in the next 30 days.
- It matches the user's selected target-city policy (allow virtual events if the preference permits them).
- It matches the chosen domain/category policy.
- Registration deadline urgency.
- Event deduplication.
- Validation of URLs and data structures.
- Whether an event is expired, cancelled, or actionable when the source data clearly indicates this.

Use a documented, consistent time-zone strategy. Store full timestamps in UTC where possible; display dates in the user's configured time zone. For date-only source fields, choose and document a predictable interpretation rather than allowing server-local time to affect results.

### Gemini Flash is for contextual intelligence

Call Gemini Flash server-side to:
- Classify event topics/domains from the source title/description.
- Assess relevance to the user's stated focus areas and business-development goals.
- Return an interpretable match score (0–100) and a concise explanation.
- Produce a short summary from the supplied event data.
- Identify likely audience/event format when supported by the text.

Use structured JSON output where possible and validate it with Zod. For example, the model can return:
- `categories: string[]`
- `matched_domains: string[]`
- `relevance_score: integer 0..100`
- `match_reason: short string`
- `summary: short string`
- `audience: string | null`

Treat those fields as model assessments, not verified facts. The model must not make up new event details, registration deadlines, dates, or URLs. Supply source fields as evidence and instruct the model to indicate uncertainty when evidence is insufficient.

### Ranking

Sort qualifying events by match score, then use an appropriate deterministic tie-breaker (such as deadline urgency or event date). Do not let deadline urgency masquerade as topical relevance; show relevance and urgency separately. Keep the scoring approach documented and easy to tune. Any example weights are product choices, not exam-mandated values.

If Gemini fails or the quota is exceeded:
- Do not make up summaries or scores.
- Preserve valid source data.
- Either apply a clearly marked simpler rules-based fallback score or mark the AI assessment as unavailable.
- Show the state in the dashboard/logs.

### Deadline logic — must be testable

The requirement says registration deadlines **fewer than seven days away** must be clearly flagged.
- Flag a known, future registration deadline when `deadline - now < 7 days`.
- Exactly seven days away does **not** satisfy “fewer than seven days”.
- If the deadline has passed, mark the listing as registration closed/expired when the data supports this; do not show it as normally actionable.
- If the deadline is missing, show “Deadline not listed” or “Verify deadline”; do not infer the event date to be the deadline.
- Use one consistent time zone/date interpretation for comparisons, and test boundaries: less than seven days, exactly seven days, expired, and unknown.

### Thirty-day window

The main actionable list should contain events whose start dates fall between the current time and the end of the next 30-day window. Implement this in code with a single documented rule and test it. Do not rely on the model to calculate date ranges.

---

## 7. Weekly automation and email delivery

### Scheduled flow

The intended weekly workflow is:
1. Vercel Cron triggers the server-side job on Monday morning.
2. The job verifies its secret/authorization.
3. It loads the active preferences.
4. It collects events from configured sources.
5. It validates, normalizes, and deduplicates candidates.
6. It applies date/location/category filters.
7. It runs Gemini Flash classification, summaries, relevance scoring, and explanation generation.
8. It applies the seven-day deadline rule and final sorting.
9. It saves event/run records to Supabase.
10. It renders the email from the ranked results.
11. It sends with Resend.
12. It records success/failure and the provider response/identifier where available.

Vercel Cron schedules are interpreted in UTC; convert the intended local Monday-morning delivery time accordingly and check current free-plan scheduling restrictions and timing precision. For an initial target of 08:00 Asia/Kolkata on Monday, the nominal UTC time is 02:30 UTC Monday, but don't promise exact minute-level delivery if the chosen plan doesn't guarantee it.

### Reliability requirements

- Protect the cron endpoint with a secret and compare it safely.
- Ensure duplicate requests/retries do not send the same digest more than once for a scheduled run. Use a unique run key/idempotency guard in the database.
- Log job start/end, source failures, discovered/filtered counts, AI failures, recipient, email status, and errors without logging secrets.
- Return useful HTTP errors/status for the scheduler and dashboard.
- Have an empty-results email or a clear no-events outcome. Do not fabricate events to make the email look full.
- If Resend fails, record it as failed and show a retry/manual action if practical; never log success falsely.
- Do not put API keys, Supabase service-role keys, or cron secrets in browser-visible code.
- Keep test-email actions separate from the scheduled production job.

---

## 8. Suggested Supabase schema

Implement a compact schema with migrations checked into the repository. Adjust naming as needed to fit the chosen Supabase pattern, but preserve the capabilities below.

### `user_preferences`

Suggested fields:
- `id` UUID primary key
- `user_id` UUID, if using Supabase Auth
- `email` text
- `domains` text array
- `cities` text array
- `categories` text array
- `allow_online_events` boolean
- `timezone` text, default `Asia/Kolkata`
- `max_digest_events` integer, with a sensible default
- `created_at`, `updated_at`

### `events`

Suggested fields:
- `id` UUID primary key
- `dedupe_key` text unique when possible
- `title`, `description`, `organizer`
- `start_at`, `end_at` timestamps nullable when unknown
- `event_date` date if a source truly only provides a date
- `timezone`, `city`, `venue`, `is_online`
- `event_url`, `registration_url`, `registration_deadline`
- `registration_status` (for example: open, deadline_unknown, closed, cancelled, unknown)
- `categories` text array and `matched_domains` text array
- `relevance_score` integer nullable
- `ai_summary`, `match_reason` text nullable
- `source_name`, `source_url`, `source_retrieved_at`
- `raw_data` JSONB when needed for traceability; avoid storing unnecessary large payloads
- `first_seen_at`, `last_seen_at`, `created_at`, `updated_at`

If retaining several source URLs for one event, a separate `event_sources` table is cleaner.

### `event_sources` (recommended)
- `id` UUID primary key
- `event_id` foreign key to `events`
- `source_name`, `source_url`, `discovered_at`
- Optional unique constraint on `(event_id, source_url)`.

### `digest_runs`
- `id` UUID primary key
- `run_key` unique identifier used for idempotency (for example, scheduled Monday date plus preference/user ID)
- `trigger_type` (`cron`, `manual_refresh`, `test_email`)
- `status` (`running`, `succeeded`, `partial_failure`, `failed`)
- counts for discovered, normalized, deduplicated, filtered, and emailed events
- `recipient_email`, `resend_email_id` nullable
- `started_at`, `finished_at`, `error_summary`

Use indexes on event start date, city, registration deadline, relevance score, and dedupe key as appropriate. Add RLS policies where applicable. Never expose the Supabase service-role key to the client.

---

## 9. Suggested code organization

Adapt this to the existing repository rather than replacing working code blindly.

```text
app/
  page.tsx                         # main event dashboard
  settings/page.tsx                # editable preferences
  digest/page.tsx                  # email preview / run history
  api/
    events/refresh/route.ts         # authorized manual live refresh
    cron/weekly-digest/route.ts     # scheduled weekly workflow
    digest/test/route.ts            # protected test-email endpoint
components/
  event-card.tsx
  event-filters.tsx
  urgency-badge.tsx
  preference-form.tsx
  digest-preview.tsx
  source-status.tsx
lib/
  env.ts                            # server-side environment validation
  supabase/server.ts
  supabase/client.ts
  ai/gemini.ts
  ai/schemas.ts
  sources/tavily.ts
  sources/eventbrite.ts             # optional only if access works
  sources/rss.ts
  sources/public-page.ts
  processing/normalize.ts
  processing/dedupe.ts
  processing/filter.ts
  processing/deadline.ts
  processing/rank.ts
  email/render-digest.ts
  email/resend.ts
  pipeline.ts                       # orchestrates event processing
  validation.ts
supabase/
  migrations/
docs/
  components-map.md
tests/
  deadline.test.ts
  filter.test.ts
  dedupe.test.ts
  ranking.test.ts
README.md
CLAUDE.md
```

Don't create empty modules simply to match the tree. Use a modular structure that makes the live-source adapters, business rules, AI assessment, and email delivery easy to test independently.

---

## 10. Components Map requirements and reference style

The user shared a one-page MESA Components Map for another case (Aangan Studio). The reference map is structured like a system-operating diagram rather than a generic architecture picture:
- A clear title and case label.
- A short explanation of how to read the map.
- **Rows are actors/components; columns are process stages.**
- Numbered steps show how data moves through the system.
- Stage headings include Trigger, Input, Context, Processing (code), AI, Output, and Human/action where useful.
- Actor rows make it clear which system owns each responsibility.
- Steps include the concrete data handoff and component/module involved.
- The lower section includes a component/status/evidence table and a “why it's shaped this way” panel.

For Industry Event Scout, map the actors/processes as appropriate:
- Vikram / preference form
- Next.js dashboard
- Tavily search and other configured source adapters (RSS, public event pages, optional Eventbrite API)
- Normalization and deduplication code
- Gemini Flash contextual classification, relevance ranking, summary, and explanation
- Server-side business rules (30-day window, target-city/category filtering, deadline warning)
- Supabase database and source provenance
- Vercel Cron / scheduled weekly workflow
- Resend email delivery
- Vikram receiving the digest and following registration/source links

Suggested stage columns:
1. Trigger
2. Input
3. Context
4. Processing (code)
5. AI
6. Output
7. Human action

Number the journey from preference setup and source retrieval, through normalisation/AI/rules, to persistence and scheduled digest delivery. Show that a user-initiated refresh and a scheduled Monday run use the same core pipeline. The scheduled job should differ only in its trigger and delivery handling, not apply a separate set of business rules.

The map should explicitly show the split of responsibility:
- **AI interprets and explains; code enforces rules.**
- **Source data grounds event facts.** Gemini must not invent deadlines or URLs.
- **One processing pipeline, multiple triggers.** Manual refresh and scheduled run share processing.
- **Source provenance matters.** Original source links are preserved.
- **Graceful failure.** One unavailable source must not silently invalidate all other results.
- **No false delivery status.** Resend confirmation and run logs establish whether the email was sent.

Create a detailed `docs/components-map.md` and/or repository-root `components-map.md`, using Mermaid plus a concise text explanation. If a visual export is requested later, it should follow the reference structure. Do not claim any component is deployed/live until it is actually working and verified; use statuses such as Planned, Implemented, Tested, and Deployed honestly.

---

## 11. Nine acceptance checks (testing checklist)

The implementation must support testing of these nine checks. Include a checkbox list in the README or a separate `docs/acceptance-checks.md` if useful.

1. **Live event discovery:** A fresh run retrieves genuine event results from multiple independent external sources or adapters, with original URLs visible.
2. **Data quality and deduplication:** Records are validated; duplicates are merged; missing deadlines/fields are reported as unknown rather than invented.
3. **Configurable preferences:** Changing selected domains, cities, or categories and saving them changes the next results without code edits.
4. **Thirty-day filtering:** The main list includes only upcoming events within the defined 30-day window and correctly handles the boundary.
5. **Gemini relevance ranking:** Gemini Flash produces valid structured assessments with a score and concise reason; invalid or unavailable model output is handled gracefully.
6. **Deadline warnings:** A known deadline fewer than seven days away is clearly flagged; exactly seven days away is not flagged by this rule; expired/unknown deadlines are handled separately.
7. **Digest quality:** Email content is concise and includes useful context, a match reason, date/location, source URL, and registration URL where available; urgent events are easy to notice.
8. **Automated Monday email:** The scheduled flow uses the same pipeline, sends via Resend when correctly configured, and logs success or failure without duplicate sends for the same run.
9. **Exam readiness and deployment:** Public Vercel URL works; GitHub repository is available; Components Map exists; required AI work calls Gemini Flash rather than the Claude API; environment secrets are not exposed.

These are project acceptance checks, not an official scoring rubric supplied by MESA.

---

## 12. Security, observability, and quality bar

- Put all keys in environment variables and keep `.env.local` out of Git.
- Add `.env.example` with variable names and placeholder values only.
- Use server-only modules for Gemini, Tavily, Resend, Supabase service-role access, and cron secrets.
- Validate every external payload and AI response with schemas.
- Sanitize event text before rendering it into HTML email or the dashboard.
- Treat web content as untrusted; don't execute scraped scripts or let source text change application instructions.
- Protect refresh/test-email routes from abuse; ensure cron secrets are checked server-side.
- Add useful structured logs and visible source/job/email status, without exposing credentials or sensitive data.
- Make API errors actionable, but never show secrets or raw confidential stack traces to the user.
- Ensure the layout works on desktop and mobile and has accessible labels/contrast.
- No fabricated live event results, fake registration links, fake relevance explanations, or false “email sent” confirmations.

---

## 13. Environment variables

Use an `.env.example` documenting at least the applicable variables:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google Gemini (server-side only)
GEMINI_API_KEY=
GEMINI_MODEL=

# Tavily (server-side only)
TAVILY_API_KEY=

# Optional source adapter; use only if access is available
EVENTBRITE_API_TOKEN=

# Resend (server-side only)
RESEND_API_KEY=
RESEND_FROM_EMAIL=
DIGEST_TO_EMAIL=

# Vercel scheduled job
CRON_SECRET=

# Application settings
APP_URL=
DEFAULT_TIMEZONE=Asia/Kolkata
```

Only require `EVENTBRITE_API_TOKEN` if that adapter is actually enabled. Validate required variables at server startup or when the relevant service is called, and return clear missing-configuration messages. Do not expose server-side variables through `NEXT_PUBLIC_` prefixes.

---

## 14. Implementation approach for Claude Code

Work in this order, checking the existing repository at the beginning:

1. Inspect the current files and package manager before making changes. Preserve useful existing work.
2. Establish the Next.js app and deployable baseline; add consistent styling and main dashboard/settings/digest pages.
3. Create the Supabase migration/schema and preferences read/write path.
4. Implement source adapters and normalized event schema. Get real data returning before focusing on visual polish.
5. Implement validation, deduplication, target filters, 30-day logic, deadline checks, and tests.
6. Integrate Gemini Flash through a server-only module and validate structured output.
7. Implement the shared processing pipeline, event persistence, source status, and run logging.
8. Implement the email HTML renderer and Resend adapter.
9. Implement protected manual refresh/test-email routes and the Vercel scheduled Monday workflow with idempotency.
10. Add unit tests for date boundaries, deadline boundaries, deduplication, filtering and ranking.
11. Write README setup/deployment instructions, `.env.example`, Components Map and the nine acceptance checks.
12. Run lint/type-check/tests/build, fix failures, and report precisely what was verified versus what still requires real credentials or deployment.

### Behaviour expected from the coding agent

- Make concrete implementation changes, not only provide a plan.
- Do not ask the user questions if a reasonable default lets you proceed; document assumptions instead.
- Do not overwrite existing files blindly; inspect them first.
- Do not hardcode secrets or actual event records as the live data source.
- Do not use Claude API in the application; Gemini Flash is mandatory for product AI.
- Do not introduce paid APIs, services, or dependencies that need a paid licence. If a source's free availability/access is uncertain, isolate it as optional and explain how to disable it.
- Do not claim deployment, email delivery, source connectivity, or tests succeeded unless they actually ran successfully.
- Where credentials are unavailable, still implement the integration, provide `.env.example`, use clear disabled/configuration states, and identify the manual step needed to verify it.
- Keep code readable and reasonably small; prioritise the end-to-end workflow over unnecessary features.

---

## 15. Definition of done

The project is ready for submission when:

- The public Vercel application opens and shows a working dashboard/settings experience.
- A live refresh can query configured real event sources when valid free-tier credentials/access are present.
- Event details retain source URLs and do not invent unknown facts.
- Configured preferences affect results.
- Date filtering, relevance ordering and deadline warnings are implemented and tested.
- Gemini Flash is used for the intended AI tasks; no Claude API is used by the app.
- The weekly workflow is configured in Vercel and uses the same event-processing pipeline as manual refresh.
- Resend can deliver a test digest when its API/domain setup is valid; failures are visible and logged.
- Supabase persists preferences, event records/source provenance, and digest-run outcomes.
- The repository contains setup instructions, `.env.example`, Components Map and nine acceptance checks.
- The submitted Vercel URL and GitHub link are real, accessible, and tested.

**The guiding principle:** Discover from live sources, let Gemini Flash interpret relevance, let deterministic code enforce dates and deadlines, preserve source evidence, and deliver an actionable digest automatically—using free-tier/open-source services wherever possible.

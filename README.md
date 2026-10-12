# Industry Event Scout

AI-ranked weekly digest of professional events (conferences, CXO summits, roundtables, startup meetups) for an independent consultant. It discovers events from live public sources, lets **Gemini Flash** judge relevance, lets deterministic code enforce dates and deadlines, and emails a scannable digest every Monday morning.

- **Live sources:** Luma city pages and AllEvents.in city pages (schema.org data, no key), Tavily web search (free key), RSS/Atom feeds (Google News search feeds by default), extra organiser pages you add in Settings, optional Eventbrite organiser API.
- **AI:** Google Gemini Flash only (`@google/genai`, model from `GEMINI_MODEL`). The app never calls the Claude API.
- **Stack:** Next.js 16 (App Router, TypeScript, Tailwind) on Vercel Hobby · Supabase Postgres · Resend · Vercel Cron.
- **Design:** “Obsidian & Lime” glassmorphism — Space Grotesk + JetBrains Mono, #ccff00 accent, floating rounded shell, bento overview, 60 px grid + noise texture. All hero/bento content is computed from real events (no placeholder data).
- **Docs:** [Components Map](docs/components-map.md) · [Acceptance checks](docs/acceptance-checks.md) · [Product brief](CLAUDE.md)

> Public URL: _add after deployment_ · Repository: _add after pushing to GitHub_

## Pages

| Route | Purpose |
|---|---|
| `/` | Dashboard: 30-day window, counts, filters (city, domain, deadline, source), ranked cards with match score + reason, urgency badges, source provenance; tabs for *Needs verification*, *Registration closed*, *Filtered out*; per-source status of the last run; **Refresh events** (admin). |
| `/settings` | Edit domains, cities, formats, recipient, time zone, digest size, minimum relevance, RSS feeds, extra pages (admin). Shows which integrations are configured. |
| `/digest` | Exact preview of the email (same renderer and data as the scheduled send), **Send test email** (admin), run history with Resend ids and errors. |
| `/login` | Admin sign-in (single password, httpOnly cookie). |

API: `POST /api/events/refresh` (admin or `Bearer CRON_SECRET`), `GET /api/cron/weekly-digest` (Vercel Cron, `Bearer CRON_SECRET`), `POST /api/digest/test` (admin), `POST /api/preferences` (admin).

## How it works

1. Preferences → targeted search queries and city pages.
2. All adapters run independently; a failure becomes a visible `error` status, others continue.
3. Result pages are fetched politely (robots.txt honoured, login-walled sites such as LinkedIn never fetched) and schema.org `Event` JSON-LD is extracted deterministically.
4. Pages without structured data go to Gemini for **grounded** extraction: the model must quote the date/deadline verbatim, and code rejects any value the quote doesn't support.
5. Records are validated (Zod), normalised to UTC, and deduplicated (URL, else title + same date + same city; different dates never merge).
6. Gemini Flash classifies domains/format and returns a 0–100 relevance score, a short reason and a summary (JSON schema + Zod). If Gemini is missing/fails, a clearly labelled rules-based score is used and no summary is invented.
7. Code applies the rules: 30-day window, target cities (aliases such as Bangalore/Bengaluru, Delhi NCR → Gurugram/Noida), online policy, domain/format policy, minimum score, cancelled/closed, **deadline < 7 days ⇒ urgent**; then ranks by score → urgency → date.
8. Events, source provenance and run logs are stored in Supabase. The Monday job renders the digest and sends it through Resend.

### Key rules (all in code, unit-tested)

- **30-day window** (`lib/processing/filter.ts`): timed events qualify when `now ≤ start ≤ now + 30 days`; date-only events when their local date is between today and the window-end date (inclusive) in the user's time zone.
- **Deadline** (`lib/processing/deadline.ts`): urgent iff `0 < deadline − now < 7 days`; exactly 7 days is *not* urgent; `≤ 0` is closed; missing is "Deadline not listed — verify". Deadlines are never inferred from the event date.
- **Time zones** (`lib/time.ts`): instants stored in UTC; display in the configured zone (default `Asia/Kolkata`); a date-only start is local midnight; a date-only deadline is the end of that local day.
- **Ranking**: relevance first; urgency is only a tie-breaker and is shown separately. The digest takes the top N (configurable) plus up to 5 extra urgent events so closing deadlines aren't hidden.

## Local setup

```bash
npm install
```

```bash
cp .env.example .env.local
```

Fill in `.env.local` (see below), then:

```bash
npm run dev
```

Without any keys the app still runs: Luma, AllEvents.in and RSS work, results are held in memory (flagged in the UI), and relevance uses the labelled rules fallback. Set at least `ADMIN_PASSWORD` to use Refresh/Settings, and `CRON_SECRET` to call the cron route.

Checks:

```bash
npm test
```

```bash
npm run lint
```

```bash
npm run build
```

## Services to configure (all free tiers)

| Service | Variables | Steps |
|---|---|---|
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (`NEXT_PUBLIC_SUPABASE_ANON_KEY` is not used by the app) | Create a free project → SQL editor → run `supabase/migrations/20261012000000_init.sql` (or `supabase db push`). RLS is enabled with no policies, so only the server's service-role key can read/write. Free projects pause after ~7 days without activity; the weekly job usually keeps it active, but check the dashboard before the exam demo. |
| **Gemini** | `GEMINI_API_KEY`, `GEMINI_MODEL` | Create a key at Google AI Studio. `GEMINI_MODEL` defaults to `gemini-flash-latest`; set a specific current Flash model ID if you prefer. Check the free-tier rate limits for that model; the app batches 8–12 events per call and caps calls per run. |
| **Tavily** | `TAVILY_API_KEY` | Free plan credits; each run uses ≤ 6 basic searches. |
| **Resend** | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `DIGEST_TO_EMAIL` | With `onboarding@resend.dev` you can only send to your own Resend account email. To email anyone else, verify a domain in Resend and use an address on it. |
| **Admin / cron** | `ADMIN_PASSWORD`, `CRON_SECRET` | Long random values (e.g. `openssl rand -hex 32`). Share `ADMIN_PASSWORD` with evaluators only if they should be able to refresh. |
| Eventbrite (optional) | `EVENTBRITE_API_TOKEN`, `EVENTBRITE_ORGANIZER_IDS` | Eventbrite's public search API is retired, so this adapter only lists live events of the organiser IDs you provide. Leave blank to disable. |

## Deploy (manual steps)

1. Create a GitHub repository and push this project.
2. In Vercel, *Add New Project* → import the repo (framework auto-detected).
3. Add every variable from `.env.example` under *Settings → Environment Variables* (Production). Set `APP_URL` to the production URL.
4. Deploy. `vercel.json` registers the cron `30 2 * * 1` (Monday 02:30 UTC ≈ 08:00 IST). On the Hobby plan crons run at most once a day and may fire any time within the scheduled hour. Vercel automatically sends `Authorization: Bearer $CRON_SECRET`.
5. Open the URL → `/login` → *Settings*: set your email and preferences → Dashboard → **Refresh events**.
6. `/digest` → **Send test email**; confirm a Resend id appears in the run history.
7. Optional: trigger the cron route once to verify (it will not send twice in the same week):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/weekly-digest
```

Refresh and cron routes set `maxDuration = 300`; the pipeline caps pages fetched and AI batches to stay inside that budget.

## Honesty and safety notes

- No hardcoded events or demo data are used anywhere. If nothing matches, the dashboard and email say so.
- Coverage is limited to the sources listed in each run's status panel; LinkedIn and other login-walled sites are not scraped (Tavily may surface public indexed announcements).
- Relevance scores, reasons and summaries are model assessments, labelled as such; event facts come from the linked sources.
- Scraped text is treated as untrusted: it is HTML-escaped when rendered and wrapped as data in Gemini prompts.
- Secrets are only read server-side (`server-only` modules); nothing secret uses a `NEXT_PUBLIC_` prefix.
- An email is recorded as sent only when Resend returns an id.

## Project layout

```text
app/                    pages + route handlers (dashboard, settings, digest, login, api/*)
components/             UI components (event card, filters, urgency badge, source status, forms)
lib/sources/            adapters: tavily, public-page (Luma, AllEvents, custom), rss, eventbrite, jsonld, http
lib/processing/         normalize, dedupe, filter (30-day window + policies), deadline, rank, rules-score, cities
lib/ai/                 gemini (assessment + grounded extraction), schemas, grounding checks
lib/email/              render-digest (shared renderer), resend
lib/pipeline.ts         the single processing pipeline
lib/jobs.ts             weekly digest (idempotent), manual refresh, test email
lib/store/              Supabase store + in-memory dev fallback
supabase/migrations/    schema + RLS
tests/                  vitest unit tests
docs/                   components map, acceptance checks
```

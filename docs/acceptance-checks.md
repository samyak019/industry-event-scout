# Acceptance checks

Project acceptance checks from `CLAUDE.md` §11 (not an official MESA rubric). ✅ = verified locally on 12 Oct 2026; ⏳ = requires credentials or deployment, with the exact step to verify.

1. **Live event discovery**
   - [x] ✅ Fresh local run retrieved real events from Luma (3 city pages, 32 events) and AllEvents.in (9 pages, 132 events), plus 44 RSS items; original URLs shown on every card.
   - [x] ✅ With `TAVILY_API_KEY` set: 6 queries → 23–31 unique result URLs; pages with schema.org data and Gemini-grounded extraction added events (local run, 12 Oct 2026).
2. **Data quality and deduplication**
   - [x] ✅ Zod validation of every record; invalid URLs/titles dropped (`tests/time.test.ts`).
   - [x] ✅ Duplicates merged across sources/aliases while separate editions stay apart (`tests/dedupe.test.ts`); 164 → 128 unique in the live run.
   - [x] ✅ Missing deadline shows “Deadline not listed — verify”; unknown date/location goes to *Needs verification* (`tests/filter.test.ts`).
3. **Configurable preferences**
   - [x] ✅ Changing cities to Bengaluru-only in `/settings` changed the dashboard immediately (actionable 40 → 21 in the local run) — no code edit.
   - [ ] ⏳ Persistence across deploys requires Supabase (otherwise in-memory, flagged in the UI).
4. **Thirty-day filtering**
   - [x] ✅ Single rule in `lib/processing/filter.ts#windowCheck`; boundaries tested (now, now+30 d, +30 d+1 ms, past, date-only today / day 30 / day 31).
5. **Gemini relevance ranking**
   - [x] ✅ Output schema + Zod validation, domain/category whitelisting and failure fallback unit-tested with a mocked model (`tests/gemini.test.ts`).
   - [x] ✅ Live: `gemini-flash-latest` (resolved to `gemini-3.8-flash`) — 10 calls, 0 failures, 72 events scored with reasons and summaries; full refresh in ~51 s.
6. **Deadline warnings**
   - [x] ✅ `< 7 days` urgent; exactly 7 days not urgent; past → *Registration closed*; missing → unknown (`tests/deadline.test.ts`). Urgent events get a lime “closes in N days” badge on the dashboard and a red badge in the email.
7. **Digest quality**
   - [x] ✅ Email shows title, date, location, summary, why-it-matches, relevance, deadline status, Register link (when the source has one) and source link; HTML-escaped (`tests/digest.test.ts`); preview at `/digest` uses the same renderer.
8. **Automated Monday email**
   - [x] ✅ Cron route rejects missing/wrong secret (401); runs the shared pipeline; second call in the same week returns `skipped` (idempotent run key).
   - [x] ✅ Without Resend/recipient the run is recorded as failed/not sent — never as sent.
   - [ ] ⏳ Live send: configure Resend + recipient → `/digest` → *Send test email* → run history shows `sent` with a Resend id.
9. **Exam readiness and deployment**
   - [x] ✅ `npm run build`, `npm run lint`, `npm test` (46 tests) pass; Components Map in `docs/components-map.md`; product AI uses only Gemini (`@google/genai`), no Claude API; secrets are server-only (no `NEXT_PUBLIC_` secrets).
   - [ ] ⏳ Push to GitHub, deploy on Vercel, open the public URL and record it in the README.

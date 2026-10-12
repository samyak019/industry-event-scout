import "server-only";
import type { AiStatus, ClassifiedEvent, EventRecord, Preferences, RawCandidate, RunCounts, SourceStatus } from "./types";
import type { SourceAdapter } from "./sources/types";
import { tavilyAdapter } from "./sources/tavily";
import { rssAdapter } from "./sources/rss";
import { alleventsAdapter, customPagesAdapter, lumaAdapter } from "./sources/public-page";
import { eventbriteAdapter } from "./sources/eventbrite";
import { fetchPublicPage, mapLimit } from "./sources/http";
import { extractJsonLdEvents, extractPageText } from "./sources/jsonld";
import { GeminiSession, assessEvents, extractEvents, type ExtractInput } from "./ai/gemini";
import { dedupeEvents } from "./processing/dedupe";
import { classifyAll, windowCheck } from "./processing/filter";
import { rankEvents } from "./processing/rank";
import { keywordPreScore, rulesAssessment } from "./processing/rules-score";
import { matchTargetCity } from "./processing/cities";
import { DAY_MS } from "./time";
import { getStore } from "./store";

export const ADAPTERS: SourceAdapter[] = [tavilyAdapter, lumaAdapter, alleventsAdapter, rssAdapter, customPagesAdapter, eventbriteAdapter];

/** Caps that keep a run inside the Vercel Hobby function limit and the free API quotas. */
const LIMITS = {
  pagesToEnrich: 24,
  aiExtractInputs: 32,
  aiAssessEvents: 72,
};

export type PipelineResult = {
  events: ClassifiedEvent[];
  sourceStatus: SourceStatus[];
  aiStatus: AiStatus;
  counts: RunCounts;
  persisted: boolean;
  storeKind: "supabase" | "memory";
  warnings: string[];
};

function log(stage: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ app: "industry-event-scout", stage, ...data }));
}

/** Step 2: run every adapter independently; a failing source never breaks the others. */
async function collect(prefs: Preferences, now: Date, retrievedAt: string) {
  const statuses: SourceStatus[] = [];
  const candidates: RawCandidate[] = [];
  await Promise.all(
    ADAPTERS.map(async (adapter) => {
      const t0 = Date.now();
      try {
        const out = await adapter.run({ prefs, now, retrievedAt });
        candidates.push(...out.candidates);
        statuses.push({
          source: adapter.name,
          status: out.status ?? "ok",
          message: out.message,
          candidates: out.candidates.length,
          events: out.candidates.reduce((n, c) => n + (c.structured?.length ?? 0), 0),
          duration_ms: Date.now() - t0,
        });
      } catch (err) {
        statuses.push({
          source: adapter.name,
          status: "error",
          message: err instanceof Error ? err.message.slice(0, 300) : "Unknown error",
          candidates: 0,
          events: 0,
          duration_ms: Date.now() - t0,
        });
      }
    }),
  );
  statuses.sort((a, b) => ADAPTERS.findIndex((x) => x.name === a.source) - ADAPTERS.findIndex((x) => x.name === b.source));
  return { statuses, candidates };
}

/**
 * Step 3: turn unstructured candidates (search results, feed items) into events.
 * First try the page's own schema.org JSON-LD (deterministic); otherwise queue
 * the text for grounded Gemini extraction.
 */
async function enrich(candidates: RawCandidate[], prefs: Preferences) {
  const structured: EventRecord[] = [];
  const toExtract: ExtractInput[] = [];
  const unstructured: RawCandidate[] = [];
  for (const c of candidates) {
    if (c.structured?.length) structured.push(...c.structured);
    else unstructured.push(c);
  }

  const fetchable = unstructured.filter((c) => c.fetchable).slice(0, LIMITS.pagesToEnrich);
  const fetchSet = new Set(fetchable);
  let enrichedPages = 0;
  await mapLimit(fetchable, 6, async (c) => {
    const page = await fetchPublicPage(c.source_url, 8000);
    if (page.ok) {
      const evs = extractJsonLdEvents(page.html, page.finalUrl, c.source_name, c.retrieved_at, prefs.timezone);
      if (evs.length) {
        enrichedPages++;
        // Keep the search result as an extra provenance record.
        structured.push(...evs.map((e) => ({ ...e, data_notes: [...e.data_notes, `Discovered via ${c.source_name}`] })));
        return;
      }
      const text = extractPageText(page.html);
      toExtract.push({ candidate: { ...c, title: text.title ?? c.title }, text: `${c.snippet}\n${text.text}`.slice(0, 3500) });
      return;
    }
    toExtract.push({ candidate: c, text: c.snippet });
  });
  for (const c of unstructured) {
    if (!fetchSet.has(c) && c.snippet) toExtract.push({ candidate: c, text: c.snippet });
  }
  return { structured, toExtract: toExtract.filter((x) => x.text.trim().length > 40), enrichedPages };
}

/**
 * The single processing pipeline used by BOTH the manual refresh and the scheduled
 * Monday job. Triggers differ only in what they do with the result (email or not).
 */
export async function runPipeline(opts: { prefs: Preferences; now?: Date; deadlineMs?: number; persist?: boolean }): Promise<PipelineResult> {
  const now = opts.now ?? new Date();
  const prefs = opts.prefs;
  const deadlineMs = opts.deadlineMs ?? Date.now() + 270_000;
  const retrievedAt = now.toISOString();
  const warnings: string[] = [];
  const gemini = new GeminiSession(deadlineMs);

  // 1-2. Collect from all sources.
  const { statuses, candidates } = await collect(prefs, now, retrievedAt);
  log("collect", { sources: statuses.map((s) => ({ s: s.source, st: s.status, n: s.candidates })) });

  // 3. Enrich + grounded extraction.
  const { structured, toExtract, enrichedPages } = await enrich(candidates, prefs);
  let extracted: EventRecord[] = [];
  if (toExtract.length) {
    if (gemini.usable) {
      const res = await extractEvents(gemini, toExtract.slice(0, LIMITS.aiExtractInputs), prefs, now);
      extracted = res.events;
      log("extract", { inputs: toExtract.length, attempted: res.attempted, extracted: res.events.length, nonEvents: res.rejectedNonEvents });
      if (toExtract.length > LIMITS.aiExtractInputs) warnings.push(`${toExtract.length - LIMITS.aiExtractInputs} unstructured result(s) skipped to stay within free-tier limits`);
    } else {
      warnings.push(`${toExtract.length} unstructured result(s) could not be read without Gemini (no structured event data on page)`);
    }
  }
  if (enrichedPages) log("enrich", { pagesWithJsonLd: enrichedPages });

  // 4-5. Validate (done in buildEventRecord) + deduplicate.
  const normalized = [...structured, ...extracted];
  const deduped = dedupeEvents(normalized);

  // 6. Cheap deterministic pre-filter so AI quota is spent only on plausible events.
  const plausible = deduped.filter((e) => {
    if (e.event_status === "cancelled") return false;
    const w = windowCheck(e, now, prefs.timezone);
    if (w === "past" || w === "beyond") return false;
    if (e.is_online === true) return prefs.allow_online_events;
    if (e.city || e.venue) return matchTargetCity({ city: e.city, venue: e.venue }, prefs.cities) !== null;
    return true;
  });

  // 7. Gemini classification, relevance, summary, explanation (rules fallback otherwise).
  const prioritized = [...plausible].sort((a, b) => keywordPreScore(b, prefs) - keywordPreScore(a, prefs));
  const forAi = prioritized.slice(0, LIMITS.aiAssessEvents);
  const assessments = gemini.usable ? await assessEvents(gemini, forAi, prefs) : new Map<string, Partial<EventRecord>>();
  let rulesUsed = 0;
  const assessed = deduped.map((e) => {
    if (!plausible.includes(e)) return e;
    const a = assessments.get(e.dedupe_key);
    if (a) return { ...e, ...a };
    rulesUsed++;
    return { ...e, ...rulesAssessment(e, prefs) };
  });
  if (plausible.length > LIMITS.aiAssessEvents && gemini.configured) {
    warnings.push(`${plausible.length - LIMITS.aiAssessEvents} lower-priority event(s) scored with the rules-based fallback to stay within the Gemini free tier`);
  }
  log("assess", { plausible: plausible.length, gemini: assessments.size, rules: rulesUsed });

  // 8. Deterministic rules: window, city, domain/category, deadline, then rank.
  const classified = rankEvents(classifyAll(assessed, prefs, now));
  const counts: RunCounts = {
    discovered: candidates.length,
    normalized: normalized.length,
    deduplicated: deduped.length,
    actionable: classified.filter((e) => e.bucket === "actionable").length,
    needs_verification: classified.filter((e) => e.bucket === "needs_verification").length,
    emailed: 0,
  };

  // 9. Persist everything in or near the window (for provenance), not far-future/past noise.
  const store = getStore();
  let persisted = false;
  if (opts.persist !== false) {
    const keep = classified.filter((e) => e.bucket !== "excluded" || e.reasons.some((r) => !/past|window/i.test(r)));
    try {
      await store.upsertEvents(keep.map(stripClassification), now);
      persisted = true;
    } catch (err) {
      warnings.push(err instanceof Error ? err.message : "Could not save events");
    }
  }

  const aiStatus = gemini.configured
    ? gemini.status(gemini.calls === 0 ? "No events needed AI processing" : undefined)
    : gemini.status();
  log("done", { counts, ai: aiStatus.status, persisted, store: store.kind });
  return { events: classified, sourceStatus: statuses, aiStatus, counts, persisted, storeKind: store.kind, warnings };
}

export function stripClassification(e: ClassifiedEvent | EventRecord): EventRecord {
  const { bucket: _b, reasons: _r, deadline: _d, ...rest } = e as ClassifiedEvent;
  void _b;
  void _r;
  void _d;
  return rest;
}

/** Dashboard/digest read path: stored events re-classified against current prefs and time. */
export async function loadCurrentEvents(prefs: Preferences, now = new Date()): Promise<ClassifiedEvent[]> {
  const store = getStore();
  const recent = await store.listRecentEvents(new Date(now.getTime() - 14 * DAY_MS));
  // Merge records that different runs discovered via different URLs.
  return rankEvents(classifyAll(dedupeEvents(recent), prefs, now));
}

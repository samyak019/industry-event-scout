import type { EventRecord } from "../types";
import { normalizeTitleKey, normalizeUrlKey } from "./normalize";
import { canonicalCity } from "./cities";

/**
 * Deduplication rule:
 * 1. Same normalized event/registration URL  => same event.
 * 2. Otherwise same local start date AND (near-)identical normalized title
 *    (token Jaccard >= 0.8) AND compatible location => same event.
 * Two records with different start dates are never merged, so separate editions
 * of a recurring conference stay separate.
 */

function tokens(title: string): Set<string> {
  return new Set(normalizeTitleKey(title).split(" ").filter((t) => t.length > 1));
}

export function titleSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

function locationsCompatible(a: EventRecord, b: EventRecord): boolean {
  if (!a.city || !b.city) return true;
  return canonicalCity(a.city) === canonicalCity(b.city);
}

function urlKeys(e: EventRecord): string[] {
  const keys = [normalizeUrlKey(e.event_url)];
  if (e.registration_url) keys.push(normalizeUrlKey(e.registration_url));
  return keys;
}

export function isSameEvent(a: EventRecord, b: EventRecord): boolean {
  const ka = urlKeys(a);
  const kb = urlKeys(b);
  const urlMatch = ka.some((k) => kb.includes(k));
  if (urlMatch) {
    // Same URL but different dates => a different edition/instance (e.g. recurring listing page).
    return !(a.event_date && b.event_date && a.event_date !== b.event_date);
  }
  if (!a.event_date || !b.event_date || a.event_date !== b.event_date) return false;
  return titleSimilarity(a.title, b.title) >= 0.8 && locationsCompatible(a, b);
}

/** Completeness score used to pick the primary record when merging. */
function richness(e: EventRecord): number {
  let s = 0;
  if (e.extraction_method === "json-ld" || e.extraction_method === "eventbrite-api") s += 10;
  if (e.start_at && !e.date_only) s += 3;
  for (const v of [e.description, e.organizer, e.venue, e.city, e.registration_url, e.registration_deadline]) if (v) s += 1;
  return s;
}

function mergeInto(primary: EventRecord, other: EventRecord): EventRecord {
  const merged: EventRecord = { ...primary };
  // Fill gaps from the secondary record without overriding primary facts.
  merged.description ??= other.description;
  merged.organizer ??= other.organizer;
  merged.venue ??= other.venue;
  merged.city ??= other.city;
  merged.registration_url ??= other.registration_url;
  if (!merged.registration_deadline && other.registration_deadline) {
    merged.registration_deadline = other.registration_deadline;
    merged.deadline_source = other.deadline_source;
  }
  if (merged.is_online === null) merged.is_online = other.is_online;
  if (merged.event_status === "unknown") merged.event_status = other.event_status;
  if (other.event_status === "cancelled") merged.event_status = "cancelled";
  const seen = new Set(merged.sources.map((s) => s.source_url));
  merged.sources = [...merged.sources];
  for (const s of other.sources) {
    if (!seen.has(s.source_url)) {
      merged.sources.push(s);
      seen.add(s.source_url);
    }
  }
  merged.data_notes = [...new Set([...merged.data_notes, ...other.data_notes])];
  // Keep any assessment that exists.
  if (merged.relevance_score === null && other.relevance_score !== null) {
    merged.relevance_score = other.relevance_score;
    merged.ai_summary = other.ai_summary;
    merged.match_reason = other.match_reason;
    merged.matched_domains = other.matched_domains;
    merged.categories = other.categories;
    merged.format = other.format;
    merged.audience = other.audience;
    merged.assessment_method = other.assessment_method;
  }
  return merged;
}

export function dedupeEvents(events: EventRecord[]): EventRecord[] {
  const groups: EventRecord[][] = [];
  for (const e of events) {
    const group = groups.find((g) => g.some((x) => isSameEvent(x, e)));
    if (group) group.push(e);
    else groups.push([e]);
  }
  return groups.map((g) => {
    const sorted = [...g].sort((a, b) => richness(b) - richness(a) || a.event_url.localeCompare(b.event_url));
    return sorted.slice(1).reduce(mergeInto, sorted[0]);
  });
}

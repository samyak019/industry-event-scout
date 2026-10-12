import type { EventRecord, Preferences } from "@/lib/types";
import { defaultPreferences } from "@/lib/store/defaults";

export const TZ = "Asia/Kolkata";
// Monday 12 Oct 2026, 10:00 IST
export const NOW = new Date("2026-10-12T04:30:00.000Z");

export function prefs(over: Partial<Preferences> = {}): Preferences {
  return { ...defaultPreferences(TZ), ...over };
}

let n = 0;
export function ev(over: Partial<EventRecord> = {}): EventRecord {
  n++;
  const url = over.event_url ?? `https://example.com/events/${n}`;
  return {
    dedupe_key: `url:${url}`,
    title: `Test event ${n}`,
    description: null,
    organizer: null,
    start_at: "2026-10-20T04:30:00.000Z",
    end_at: null,
    event_date: "2026-10-20",
    date_only: false,
    timezone: null,
    city: "Bengaluru",
    venue: null,
    is_online: false,
    event_url: url,
    registration_url: null,
    registration_deadline: null,
    deadline_source: null,
    event_status: "scheduled",
    format: "conference",
    categories: ["Conferences"],
    matched_domains: ["SaaS"],
    relevance_score: 70,
    ai_summary: null,
    match_reason: "test",
    audience: null,
    assessment_method: "gemini",
    extraction_method: "json-ld",
    data_notes: [],
    source_name: "Test",
    source_url: url,
    source_retrieved_at: NOW.toISOString(),
    sources: [{ source_name: "Test", source_url: url, discovered_at: NOW.toISOString() }],
    ...over,
  };
}

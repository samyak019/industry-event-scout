import { z } from "zod";
import type { EventRecord, EventStatus, ExtractionMethod } from "../types";
import { parseSourceDate } from "../time";

const TRACKING_PARAMS = /^(utm_|fbclid|gclid|mc_|ref$|ref_|source$|aff|_ga)/i;
const HOST_ALIASES: Record<string, string> = { "lu.ma": "luma.com" };

/** Returns a canonical http(s) URL string or null if the input is not a safe web URL. */
export function cleanUrl(input: unknown, base?: string): string | null {
  if (typeof input !== "string" || !input.trim()) return null;
  let u: URL;
  try {
    u = new URL(input.trim(), base);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  return u.toString();
}

/** Normalized form used only for deduplication keys. */
export function normalizeUrlKey(input: string): string {
  try {
    const u = new URL(input);
    let host = u.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
    host = HOST_ALIASES[host] ?? host;
    const params = [...u.searchParams.entries()]
      .filter(([k]) => !TRACKING_PARAMS.test(k))
      .sort(([a], [b]) => a.localeCompare(b));
    const query = params.length ? `?${new URLSearchParams(params).toString()}` : "";
    const path = u.pathname.replace(/\/+$/, "").toLowerCase() || "/";
    return `${host}${path}${query}`;
  } catch {
    return input.trim().toLowerCase();
  }
}

/** Strip HTML tags/control chars and collapse whitespace. Output is plain text (escape again when rendering). */
export function cleanText(input: unknown, maxLen = 2000): string | null {
  if (typeof input !== "string") return null;
  const decoded = input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!decoded) return null;
  return decoded.length > maxLen ? `${decoded.slice(0, maxLen - 1).trimEnd()}…` : decoded;
}

export function normalizeTitleKey(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an|and|of|in|at|for|on|by|with)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapEventStatus(value: unknown): EventStatus {
  const s = typeof value === "string" ? value.toLowerCase() : "";
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("postpone") || s.includes("rescheduled")) return "postponed";
  if (s.includes("scheduled") || s.includes("live") || s.includes("started")) return "scheduled";
  return "unknown";
}

const EventRecordSchema = z.object({
  title: z.string().min(3).max(300),
  event_url: z.string().url(),
  source_url: z.string().url(),
  source_name: z.string().min(1),
  start_at: z.string().datetime().nullable(),
  end_at: z.string().datetime().nullable(),
  registration_deadline: z.string().datetime().nullable(),
  registration_url: z.string().url().nullable(),
  relevance_score: z.number().int().min(0).max(100).nullable(),
});

export type DraftEvent = {
  title: unknown;
  description?: unknown;
  organizer?: unknown;
  start?: unknown;
  end?: unknown;
  timezone?: string | null;
  city?: unknown;
  venue?: unknown;
  is_online?: boolean | null;
  event_url: unknown;
  registration_url?: unknown;
  registration_deadline?: unknown;
  deadline_source?: string | null;
  event_status?: unknown;
  source_name: string;
  source_url: string;
  retrieved_at: string;
  extraction_method: ExtractionMethod;
  data_notes?: string[];
};

/**
 * Build a validated EventRecord from loosely-typed source fields.
 * Returns null when mandatory fields (title, a valid URL) are missing.
 * Unknown values stay null — nothing is invented.
 */
export function buildEventRecord(d: DraftEvent, fallbackTimeZone: string): EventRecord | null {
  const title = cleanText(d.title, 300);
  const eventUrl = cleanUrl(d.event_url) ?? cleanUrl(d.source_url);
  const sourceUrl = cleanUrl(d.source_url) ?? eventUrl;
  if (!title || title.length < 3 || !eventUrl || !sourceUrl) return null;

  const tz = d.timezone ?? fallbackTimeZone;
  const notes = [...(d.data_notes ?? [])];
  const start = parseSourceDate(d.start, tz);
  const end = parseSourceDate(d.end, tz);
  if (d.start && !start) notes.push("Start date in source could not be parsed");

  let deadline: string | null = null;
  if (d.registration_deadline) {
    const parsed = parseSourceDate(d.registration_deadline, tz);
    if (parsed) {
      deadline = parsed.dateOnly
        ? // date-only deadline => end of that local day
          new Date(parsed.instant.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString()
        : parsed.instant.toISOString();
    }
  }

  const record: EventRecord = {
    dedupe_key: `url:${normalizeUrlKey(eventUrl)}|${start ? start.date : "undated"}`,
    title,
    description: cleanText(d.description, 1500),
    organizer: cleanText(d.organizer, 200),
    start_at: start ? start.instant.toISOString() : null,
    end_at: end ? end.instant.toISOString() : null,
    event_date: start ? start.date : null,
    date_only: start ? start.dateOnly : false,
    timezone: d.timezone ?? null,
    city: cleanText(d.city, 120),
    venue: cleanText(d.venue, 300),
    is_online: d.is_online ?? null,
    event_url: eventUrl,
    registration_url: cleanUrl(d.registration_url),
    registration_deadline: deadline,
    deadline_source: deadline ? (d.deadline_source ?? null) : null,
    event_status: mapEventStatus(d.event_status),
    format: null,
    categories: [],
    matched_domains: [],
    relevance_score: null,
    ai_summary: null,
    match_reason: null,
    audience: null,
    assessment_method: null,
    extraction_method: d.extraction_method,
    data_notes: notes,
    source_name: d.source_name,
    source_url: sourceUrl,
    source_retrieved_at: d.retrieved_at,
    sources: [{ source_name: d.source_name, source_url: sourceUrl, discovered_at: d.retrieved_at }],
  };

  const check = EventRecordSchema.safeParse(record);
  return check.success ? record : null;
}

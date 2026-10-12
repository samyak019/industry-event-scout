import type { Bucket, ClassifiedEvent, EventRecord, Preferences } from "../types";
import { DAY_MS, localDate } from "../time";
import { deadlineStatus } from "./deadline";
import { matchTargetCity } from "./cities";

export const WINDOW_DAYS = 30;

export type WindowResult = "in_window" | "past" | "beyond" | "unknown";

/**
 * Thirty-day window rule (single source of truth):
 *   windowStart = now, windowEnd = now + 30 days.
 * - Timed events qualify when windowStart <= start_at <= windowEnd.
 * - Date-only events qualify when their local date (user time zone) is between
 *   today's local date and windowEnd's local date, inclusive — so an event "today"
 *   with no time still counts, while yesterday's does not.
 * Events that already started are treated as past (not actionable).
 */
export function windowCheck(
  e: Pick<EventRecord, "start_at" | "date_only" | "event_date">,
  now: Date,
  timeZone: string,
): WindowResult {
  if (!e.start_at) return "unknown";
  const end = new Date(now.getTime() + WINDOW_DAYS * DAY_MS);
  if (e.date_only && e.event_date) {
    const today = localDate(now, timeZone);
    const last = localDate(end, timeZone);
    if (e.event_date < today) return "past";
    if (e.event_date > last) return "beyond";
    return "in_window";
  }
  const t = Date.parse(e.start_at);
  if (t < now.getTime()) return "past";
  if (t > end.getTime()) return "beyond";
  return "in_window";
}

export function windowBounds(now: Date) {
  return { start: now, end: new Date(now.getTime() + WINDOW_DAYS * DAY_MS) };
}

function lower(list: string[]): string[] {
  return list.map((s) => s.toLowerCase());
}

/**
 * Deterministic classification of one event against the user's preferences.
 * Order matters: the first failing rule decides the bucket.
 */
export function classifyEvent(e: EventRecord, prefs: Preferences, now: Date): ClassifiedEvent {
  const reasons: string[] = [];
  const deadline = deadlineStatus(e.registration_deadline, now);
  const done = (bucket: Bucket): ClassifiedEvent => ({ ...e, bucket, reasons, deadline });

  if (e.event_status === "cancelled") {
    reasons.push("Cancelled according to source");
    return done("excluded");
  }

  const w = windowCheck(e, now, prefs.timezone);
  if (w === "past") {
    reasons.push("Already started or past");
    return done("excluded");
  }
  if (w === "beyond") {
    reasons.push(`Starts after the ${WINDOW_DAYS}-day window`);
    return done("excluded");
  }

  // Location policy.
  let locationKnown = true;
  if (e.is_online === true) {
    if (!prefs.allow_online_events) {
      reasons.push("Online event (online events disabled in preferences)");
      return done("excluded");
    }
  } else {
    const matched = matchTargetCity({ city: e.city, venue: e.venue }, prefs.cities);
    if (!matched) {
      if (e.city || e.venue) {
        reasons.push("Outside target cities");
        return done("excluded");
      }
      locationKnown = false;
    }
  }

  // Topic (domain) policy: at least one selected domain must match.
  const prefDomains = lower(prefs.domains);
  const matchedDomains = e.matched_domains.filter((d) => prefDomains.includes(d.toLowerCase()));
  if (e.assessment_method !== null) {
    if (!matchedDomains.length) {
      reasons.push("No match with selected domains");
      return done("excluded");
    }
    if (e.relevance_score !== null && e.relevance_score < prefs.min_relevance_score) {
      reasons.push(`Relevance ${e.relevance_score} below threshold ${prefs.min_relevance_score}`);
      return done("excluded");
    }
    // Format policy: a known format that is not one of the selected categories is excluded;
    // an unknown format is kept.
    if (prefs.categories.length && e.format && !e.categories.some((c) => lower(prefs.categories).includes(c.toLowerCase()))) {
      reasons.push(`Format "${e.format}" not in selected categories`);
      return done("excluded");
    }
  }

  if (deadline.status === "closed") {
    reasons.push("Registration deadline has passed");
    return done("closed");
  }

  if (w === "unknown") reasons.push("Start date not established from source");
  if (!locationKnown) reasons.push("Location not established from source");
  if (e.assessment_method === null) reasons.push("Relevance not assessed");
  if (reasons.length) return done("needs_verification");

  return done("actionable");
}

export function classifyAll(events: EventRecord[], prefs: Preferences, now: Date): ClassifiedEvent[] {
  return events.map((e) => classifyEvent(e, prefs, now));
}

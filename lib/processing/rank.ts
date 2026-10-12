import type { ClassifiedEvent } from "../types";

/**
 * Ranking: relevance score (desc, unscored last) is primary; ties break on
 * deadline urgency (urgent first), then earlier start, then title. Urgency is a
 * tie-breaker only — it never inflates topical relevance, and both are displayed separately.
 */
export function compareEvents(a: ClassifiedEvent, b: ClassifiedEvent): number {
  const sa = a.relevance_score ?? -1;
  const sb = b.relevance_score ?? -1;
  if (sa !== sb) return sb - sa;
  const ua = a.deadline.status === "urgent" ? 0 : 1;
  const ub = b.deadline.status === "urgent" ? 0 : 1;
  if (ua !== ub) return ua - ub;
  const ta = a.start_at ? Date.parse(a.start_at) : Number.MAX_SAFE_INTEGER;
  const tb = b.start_at ? Date.parse(b.start_at) : Number.MAX_SAFE_INTEGER;
  if (ta !== tb) return ta - tb;
  return a.title.localeCompare(b.title);
}

export function rankEvents(events: ClassifiedEvent[]): ClassifiedEvent[] {
  return [...events].sort(compareEvents);
}

/** Extra urgent events allowed beyond the configured digest size. */
export const URGENT_OVERFLOW = 5;

/**
 * Digest selection: top `max` actionable events by rank, plus any remaining
 * urgent actionable events (up to URGENT_OVERFLOW) so a closing deadline is
 * never hidden just because the list was full.
 */
export function selectDigestEvents(events: ClassifiedEvent[], max: number): ClassifiedEvent[] {
  const ranked = rankEvents(events.filter((e) => e.bucket === "actionable"));
  const top = ranked.slice(0, max);
  const extraUrgent = ranked.slice(max).filter((e) => e.deadline.status === "urgent").slice(0, URGENT_OVERFLOW);
  return [...top, ...extraUrgent];
}

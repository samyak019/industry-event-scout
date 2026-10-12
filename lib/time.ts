/**
 * Time-zone strategy
 * ------------------
 * - Instants are stored as UTC ISO strings.
 * - Display uses the user's configured IANA time zone (default Asia/Kolkata).
 * - A date-only source value (e.g. "2026-11-05") is interpreted as local midnight
 *   in the event's own time zone when known, otherwise the user's time zone.
 * - A date-only registration deadline is interpreted as the END of that local day
 *   (23:59:59.999), because registrations normally stay open through the stated day.
 * Server-local time never affects any of these calculations.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

function tzOffsetMs(instantMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(new Date(instantMs)).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

/** Convert a wall-clock time in `timeZone` to a UTC instant. */
export function zonedToUtc(
  y: number,
  m: number,
  d: number,
  hh = 0,
  mm = 0,
  ss = 0,
  ms = 0,
  timeZone = "Asia/Kolkata",
): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm, ss, ms);
  let offset = tzOffsetMs(guess, timeZone);
  let result = guess - offset;
  // Second pass handles DST transitions.
  const offset2 = tzOffsetMs(result, timeZone);
  if (offset2 !== offset) {
    offset = offset2;
    result = guess - offset;
  }
  return new Date(result);
}

/** YYYY-MM-DD of an instant in a time zone. */
export function localDate(instant: Date | string, timeZone: string): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i;
const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;

export type ParsedDate = { instant: Date; dateOnly: boolean; date: string };

/**
 * Parse a source date string deterministically.
 * - "YYYY-MM-DD" -> local midnight in `timeZone`, dateOnly=true
 * - ISO with offset/Z -> exact instant
 * - ISO without offset -> wall-clock time in `timeZone`
 * Anything else returns null (we never guess free-text dates here).
 */
export function parseSourceDate(value: unknown, timeZone: string): ParsedDate | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  let m = DATE_ONLY.exec(s);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return { instant: zonedToUtc(y, mo, d, 0, 0, 0, 0, timeZone), dateOnly: true, date: s };
  }
  if (HAS_OFFSET.test(s)) {
    const t = Date.parse(s);
    if (Number.isNaN(t)) return null;
    const instant = new Date(t);
    return { instant, dateOnly: false, date: localDate(instant, timeZone) };
  }
  m = LOCAL_DATETIME.exec(s);
  if (m) {
    const instant = zonedToUtc(
      Number(m[1]),
      Number(m[2]),
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6] ?? 0),
      0,
      timeZone,
    );
    return { instant, dateOnly: false, date: `${m[1]}-${m[2]}-${m[3]}` };
  }
  return null;
}

/** End of a local calendar day, as a UTC instant. */
export function endOfLocalDay(date: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return zonedToUtc(y, m, d, 23, 59, 59, 999, timeZone);
}

export function formatEventDate(
  e: { start_at: string | null; date_only: boolean; event_date: string | null; end_at?: string | null },
  timeZone: string,
): string {
  if (!e.start_at) return "Date not established";
  const d = new Date(e.start_at);
  const dateFmt = new Intl.DateTimeFormat("en-IN", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  if (e.date_only) return dateFmt.format(d);
  const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone, hour: "numeric", minute: "2-digit" });
  return `${dateFmt.format(d)}, ${timeFmt.format(d)}`;
}

export function formatDeadline(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

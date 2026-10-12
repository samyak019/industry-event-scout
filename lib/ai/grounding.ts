/**
 * Grounding checks for AI-extracted fields. A model-extracted date/URL is only
 * accepted when the model's verbatim evidence quote really occurs in the source
 * text AND that quote supports the returned value. Otherwise the field stays null.
 */

const MONTHS = [
  ["january", "jan"],
  ["february", "feb"],
  ["march", "mar"],
  ["april", "apr"],
  ["may", "may"],
  ["june", "jun"],
  ["july", "jul"],
  ["august", "aug"],
  ["september", "sep", "sept"],
  ["october", "oct"],
  ["november", "nov"],
  ["december", "dec"],
];

export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function evidenceInSource(evidence: string | null, source: string): boolean {
  if (!evidence) return false;
  const e = normalizeForMatch(evidence);
  if (e.length < 3) return false;
  return normalizeForMatch(source).includes(e);
}

/** Does the quote mention the day and month (and year, if any year is present) of `isoDate`? */
export function evidenceSupportsDate(evidence: string | null, isoDate: string | null): boolean {
  if (!evidence || !isoDate) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const q = normalizeForMatch(evidence);

  const years = q.match(/\b20\d{2}\b/g);
  if (years && !years.includes(String(y))) return false;

  // ISO-like dates in the quote.
  if (q.includes(isoDate)) return true;

  // Ignore clock times ("6:30 pm") so the hour is never mistaken for the day.
  const withoutTimes = q.replace(/\b\d{1,2}:\d{2}\s*(am|pm)?\b|\b\d{1,2}(\.\d{2})?\s*(am|pm)\b/g, " ");
  const dayRe = new RegExp(`(^|[^0-9])0?${d}(st|nd|rd|th)?([^0-9]|$)`);
  if (!dayRe.test(withoutTimes)) return false;

  const monthNames = MONTHS[mo - 1];
  if (monthNames.some((name) => new RegExp(`\\b${name}\\b`).test(q))) return true;

  // Numeric day/month forms such as 05/11/2026, 5-11-2026 (Indian D/M order) or 2026/11/05.
  const dd = String(d).padStart(2, "0");
  const mm = String(mo).padStart(2, "0");
  const numeric = [
    `${d}/${mo}`, `${dd}/${mm}`, `${d}-${mo}`, `${dd}-${mm}`, `${d}.${mo}`, `${dd}.${mm}`,
    `${y}/${mm}/${dd}`, `${y}.${mm}.${dd}`,
  ];
  return numeric.some((n) => q.includes(n));
}

/** A URL is accepted only if it literally appears in the source text or equals a known source URL. */
export function urlGrounded(url: string | null, source: string, knownUrls: string[]): boolean {
  if (!url) return false;
  if (knownUrls.includes(url)) return true;
  return source.includes(url);
}

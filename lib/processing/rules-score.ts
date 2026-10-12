import type { EventRecord, Preferences } from "../types";

/**
 * Rules-based fallback used only when Gemini is unavailable or fails.
 * Results are labelled `assessment_method: "rules"` and no AI summary is produced.
 */

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  "enterprise technology": ["enterprise tech", "enterprise it", "enterprise software", " cio", " cto", "ciso", "it leader", "cloud computing", "cybersecurity", "data platform", "artificial intelligence", "genai", "generative ai", "technology leaders"],
  saas: ["saas", "software as a service", "b2b software", "product-led", "plg", "subscription software"],
  "digital transformation": ["digital transformation", "transformation", "digitalisation", "digitalization", "automation", "modernization", "modernisation"],
  startups: ["startup", "start-up", "founders", "venture capital", " vc ", "investors", "pitch", "incubat", "accelerat", "angel invest"],
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  conferences: ["conference", "conclave", "expo", "summit", "forum", "congress"],
  "cxo summits": ["cxo", "ceo", "cio", "cto", "cfo", "leadership summit", "c-suite", "executive"],
  roundtables: ["roundtable", "round table", "round-table", "boardroom", "closed-door"],
  "startup ecosystem meetups": ["meetup", "meet-up", "mixer", "founder", "startup"],
  "networking events": ["networking", "mixer", "connect", "meetup"],
};

function keywordsFor(label: string, table: Record<string, string[]>): string[] {
  const key = label.toLowerCase().trim();
  return table[key] ?? key.split(/[\s/&,]+/).filter((w) => w.length > 2);
}

function hits(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

export function rulesAssessment(e: EventRecord, prefs: Preferences): Partial<EventRecord> {
  const text = ` ${[e.title, e.description, e.organizer].filter(Boolean).join(" ").toLowerCase()} `;
  const matched_domains = prefs.domains.filter((d) => hits(text, keywordsFor(d, DOMAIN_KEYWORDS)));
  const categories = prefs.categories.filter((c) => hits(text, keywordsFor(c, CATEGORY_KEYWORDS)));
  // Deliberately conservative: keyword hits cannot judge seniority or quality.
  const score = matched_domains.length ? Math.min(65, 35 + 10 * matched_domains.length + (categories.length ? 5 : 0)) : 10;
  return {
    matched_domains,
    categories,
    format: null, // format unknown under rules; never excluded on format alone
    relevance_score: score,
    match_reason: matched_domains.length
      ? `Keyword match: ${matched_domains.join(", ")} (rules-based; AI assessment unavailable)`
      : "No keyword match with selected domains (rules-based)",
    ai_summary: null,
    audience: null,
    assessment_method: "rules",
  };
}

/** Cheap pre-score used to prioritise which events go to Gemini first when capped. */
export function keywordPreScore(e: EventRecord, prefs: Preferences): number {
  const text = ` ${[e.title, e.description].filter(Boolean).join(" ").toLowerCase()} `;
  let s = 0;
  for (const d of prefs.domains) if (hits(text, keywordsFor(d, DOMAIN_KEYWORDS))) s += 2;
  for (const c of prefs.categories) if (hits(text, keywordsFor(c, CATEGORY_KEYWORDS))) s += 1;
  return s;
}

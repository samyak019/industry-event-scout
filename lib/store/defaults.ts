import type { Preferences } from "../types";

/**
 * Illustrative development defaults only — NOT preferences supplied by the case.
 * Everything here is editable in Settings without code changes.
 */
export function defaultPreferences(timezone = "Asia/Kolkata", email: string | null = null): Preferences {
  return {
    email,
    domains: ["Enterprise Technology", "SaaS", "Digital Transformation", "Startups"],
    cities: ["Bengaluru", "Mumbai", "Delhi NCR"],
    categories: ["Conferences", "CXO summits", "Roundtables", "Startup ecosystem meetups", "Networking events"],
    allow_online_events: false,
    timezone,
    max_digest_events: 10,
    min_relevance_score: 40,
    rss_feeds: [
      "https://news.google.com/rss/search?q=(summit+OR+conclave+OR+roundtable)+{city}+register+when:14d&hl=en-IN&gl=IN&ceid=IN:en",
    ],
    extra_source_urls: [],
  };
}

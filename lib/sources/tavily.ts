import "server-only";
import { z } from "zod";
import { env } from "../env";
import type { Preferences, RawCandidate } from "../types";
import type { SourceAdapter } from "./types";
import { isFetchableUrl, mapLimit } from "./http";
import { cleanText, cleanUrl } from "../processing/normalize";

export const MAX_TAVILY_QUERIES = 6;

const TavilyResponse = z.object({
  results: z
    .array(
      z.object({
        title: z.string().optional().default(""),
        url: z.string(),
        content: z.string().optional().default(""),
      }),
    )
    .default([]),
});

function monthLabel(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: tz, month: "long", year: "numeric" }).format(d);
}

/** Targeted web-search queries built from the saved preferences (deterministic order, capped). */
export function buildSearchQueries(prefs: Preferences, now: Date): string[] {
  const months = [...new Set([monthLabel(now, prefs.timezone), monthLabel(new Date(now.getTime() + 30 * 86400000), prefs.timezone)])].join(" ");
  const domains = prefs.domains.slice(0, 3);
  const cats = prefs.categories.slice(0, 3);
  const queries: string[] = [];
  for (const city of prefs.cities.slice(0, 3)) {
    queries.push(`upcoming ${domains.join(" OR ")} ${cats[0] ?? "conference"} ${city} ${months} registration`);
    queries.push(`${cats[1] ?? "CXO summit"} OR ${cats[2] ?? "roundtable"} ${domains[0] ?? "technology"} ${city} ${months}`);
  }
  if (!prefs.cities.length) {
    for (const d of domains) queries.push(`upcoming ${d} ${cats[0] ?? "conference"} India ${months} registration`);
  }
  return [...new Set(queries)].slice(0, MAX_TAVILY_QUERIES);
}

export const tavilyAdapter: SourceAdapter = {
  name: "Tavily web search",
  async run(ctx) {
    const key = env.tavilyApiKey();
    if (!key) return { candidates: [], status: "disabled", message: "TAVILY_API_KEY not set — web search disabled" };

    const queries = buildSearchQueries(ctx.prefs, ctx.now);
    const errors: string[] = [];
    const perQuery = await mapLimit(queries, 3, async (query) => {
      try {
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
          body: JSON.stringify({
            query,
            search_depth: "basic",
            topic: "general",
            max_results: 8,
            include_answer: false,
            include_raw_content: false,
            country: "india",
          }),
          signal: AbortSignal.timeout(20000),
          cache: "no-store",
        });
        if (!res.ok) {
          // 429 = rate limited, 432/433 = plan/credit limit reached.
          errors.push(res.status === 432 || res.status === 433 ? "Tavily free credit limit reached" : `HTTP ${res.status}`);
          return [];
        }
        const parsed = TavilyResponse.safeParse(await res.json());
        if (!parsed.success) {
          errors.push("Unexpected response shape");
          return [];
        }
        return parsed.data.results
          .map((r): RawCandidate | null => {
            const url = cleanUrl(r.url);
            if (!url) return null;
            return {
              source_name: "Tavily search",
              source_url: url,
              retrieved_at: ctx.retrievedAt,
              title: cleanText(r.title, 300) ?? url,
              snippet: cleanText(r.content, 1500) ?? "",
              fetchable: isFetchableUrl(url),
            };
          })
          .filter((c): c is RawCandidate => c !== null);
      } catch {
        errors.push("Network error/timeout");
        return [];
      }
    });

    const seen = new Set<string>();
    const candidates = perQuery.flat().filter((c) => (seen.has(c.source_url) ? false : (seen.add(c.source_url), true)));
    if (!candidates.length && errors.length) throw new Error(`Tavily failed: ${[...new Set(errors)].join("; ")}`);
    return {
      candidates,
      status: errors.length ? "partial" : "ok",
      message: `${queries.length} quer${queries.length === 1 ? "y" : "ies"}, ${candidates.length} unique result URL(s)${errors.length ? `; errors: ${[...new Set(errors)].join("; ")}` : ""}`,
    };
  },
};

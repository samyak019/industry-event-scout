import "server-only";
import type { RawCandidate } from "../types";
import type { AdapterContext, AdapterOutput, SourceAdapter } from "./types";
import { fetchPublicPage, mapLimit } from "./http";
import { extractJsonLdEvents, extractPageText } from "./jsonld";
import { ALLEVENTS_CITY_SLUGS, LUMA_CITY_SLUGS, citySlug } from "../processing/cities";

/**
 * Public event listing pages that publish schema.org Event JSON-LD.
 * Each page is fetched with a plain HTTP GET (robots.txt honoured) and only
 * structured data present in the page is used.
 */
async function scrapeListingPages(urls: string[], sourceName: string, ctx: AdapterContext): Promise<AdapterOutput> {
  const failures: string[] = [];
  const results = await mapLimit(urls, 4, async (url) => {
    const page = await fetchPublicPage(url);
    if (!page.ok) {
      failures.push(`${url}: ${page.reason}`);
      return null;
    }
    const events = extractJsonLdEvents(page.html, page.finalUrl, sourceName, ctx.retrievedAt, ctx.prefs.timezone);
    // No structured data: keep visible text so the grounded AI extractor can try.
    const text = events.length ? null : extractPageText(page.html);
    const candidate: RawCandidate = {
      source_name: sourceName,
      source_url: page.finalUrl,
      retrieved_at: ctx.retrievedAt,
      title: text?.title ?? `${sourceName} listing`,
      snippet: text?.text ?? "",
      structured: events,
      fetchable: false,
    };
    return candidate;
  });
  const candidates = results.filter((c): c is RawCandidate => c !== null);
  const eventCount = candidates.reduce((n, c) => n + (c.structured?.length ?? 0), 0);
  if (!candidates.length && failures.length) {
    throw new Error(`All ${urls.length} page(s) failed: ${failures.slice(0, 3).join("; ")}`);
  }
  return {
    candidates,
    status: failures.length ? "partial" : "ok",
    message: `${candidates.length}/${urls.length} page(s) fetched, ${eventCount} structured event(s)${failures.length ? `; failed: ${failures.slice(0, 3).join("; ")}` : ""}`,
  };
}

export const lumaAdapter: SourceAdapter = {
  name: "Luma city pages",
  async run(ctx) {
    const slugs = [...new Set(ctx.prefs.cities.map((c) => citySlug(c, LUMA_CITY_SLUGS)))];
    return scrapeListingPages(slugs.map((s) => `https://luma.com/${s}`), "Luma", ctx);
  },
};

const ALLEVENTS_CATEGORIES = ["business", "technology", "startups"];

export const alleventsAdapter: SourceAdapter = {
  name: "AllEvents.in city pages",
  async run(ctx) {
    const slugs = [...new Set(ctx.prefs.cities.map((c) => citySlug(c, ALLEVENTS_CITY_SLUGS)))];
    const urls = slugs.flatMap((s) => ALLEVENTS_CATEGORIES.map((cat) => `https://allevents.in/${s}/${cat}`));
    return scrapeListingPages(urls, "AllEvents.in", ctx);
  },
};

/** User-configured organiser/listing pages (Settings → extra source URLs). */
export const customPagesAdapter: SourceAdapter = {
  name: "Configured public pages",
  async run(ctx) {
    const urls = ctx.prefs.extra_source_urls.slice(0, 15);
    if (!urls.length) return { candidates: [], status: "disabled", message: "No extra public pages configured in Settings" };
    return scrapeListingPages(urls, "Organiser page", ctx);
  },
};

import "server-only";
import Parser from "rss-parser";
import type { RawCandidate } from "../types";
import type { SourceAdapter } from "./types";
import { fetchText, isFetchableUrl, mapLimit } from "./http";
import { cleanText, cleanUrl } from "../processing/normalize";

const MAX_ITEMS_PER_FEED = 15;

/** Feed URLs may contain `{city}`; such feeds are expanded once per target city. */
export function expandFeedUrls(feeds: string[], cities: string[]): string[] {
  const out: string[] = [];
  for (const f of feeds) {
    if (f.includes("{city}")) {
      for (const c of cities.slice(0, 4)) out.push(f.replaceAll("{city}", encodeURIComponent(c)));
    } else out.push(f);
  }
  return [...new Set(out)].slice(0, 12);
}

export const rssAdapter: SourceAdapter = {
  name: "RSS/Atom feeds",
  async run(ctx) {
    const feeds = expandFeedUrls(ctx.prefs.rss_feeds, ctx.prefs.cities);
    if (!feeds.length) return { candidates: [], status: "disabled", message: "No RSS/Atom feeds configured in Settings" };
    const parser = new Parser();
    const failures: string[] = [];
    const lists = await mapLimit(feeds, 4, async (feedUrl) => {
      const res = await fetchText(feedUrl, 10000, "application/rss+xml, application/atom+xml, application/xml, text/xml");
      if (!res.ok) {
        failures.push(`${new URL(feedUrl).hostname}: ${res.reason}`);
        return [];
      }
      try {
        const feed = await parser.parseString(res.html);
        const feedName = cleanText(feed.title, 80) ?? new URL(feedUrl).hostname;
        return (feed.items ?? []).slice(0, MAX_ITEMS_PER_FEED).flatMap((item): RawCandidate[] => {
          const link = cleanUrl(item.link);
          const title = cleanText(item.title, 300);
          if (!link || !title) return [];
          const published = item.isoDate ? `Published ${item.isoDate.slice(0, 10)}. ` : "";
          return [
            {
              source_name: `RSS: ${feedName}`,
              source_url: link,
              retrieved_at: ctx.retrievedAt,
              title,
              snippet: `${published}${cleanText(item.contentSnippet ?? item.content ?? item.summary ?? "", 1200) ?? ""}`,
              fetchable: isFetchableUrl(link),
            },
          ];
        });
      } catch {
        failures.push(`${new URL(feedUrl).hostname}: not a valid RSS/Atom feed`);
        return [];
      }
    });
    const candidates = lists.flat();
    if (!candidates.length && failures.length === feeds.length) throw new Error(`All feeds failed: ${failures.slice(0, 3).join("; ")}`);
    return {
      candidates,
      status: failures.length ? "partial" : "ok",
      message: `${feeds.length - failures.length}/${feeds.length} feed(s) read, ${candidates.length} item(s)${failures.length ? `; failed: ${failures.slice(0, 3).join("; ")}` : ""}`,
    };
  },
};

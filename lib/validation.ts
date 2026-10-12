import { z } from "zod";
import { isValidTimeZone } from "./time";

const listItem = z.string().trim().min(1).max(80);

function splitList(v: unknown): unknown {
  if (typeof v !== "string") return v;
  return v
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const urlList = z.preprocess(
  splitList,
  z
    .array(
      z
        .string()
        .trim()
        .max(500)
        .refine((u) => {
          try {
            const p = new URL(u.replaceAll("{city}", "x"));
            return p.protocol === "https:" || p.protocol === "http:";
          } catch {
            return false;
          }
        }, "Must be a valid http(s) URL"),
    )
    .max(15),
);

export const PreferencesInput = z.object({
  email: z.preprocess((v) => (v === "" ? null : v), z.string().trim().email().max(200).nullable()),
  domains: z.preprocess(splitList, z.array(listItem).min(1, "Add at least one domain").max(12)),
  cities: z.preprocess(splitList, z.array(listItem).max(10)),
  categories: z.preprocess(splitList, z.array(listItem).max(12)),
  allow_online_events: z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean()),
  timezone: z.string().trim().refine(isValidTimeZone, "Unknown IANA time zone"),
  max_digest_events: z.coerce.number().int().min(1).max(50),
  min_relevance_score: z.coerce.number().int().min(0).max(100),
  rss_feeds: urlList,
  extra_source_urls: urlList,
}).refine((p) => p.cities.length > 0 || p.allow_online_events, {
  message: "Add at least one target city or allow online events",
  path: ["cities"],
});

export type PreferencesInputType = z.infer<typeof PreferencesInput>;

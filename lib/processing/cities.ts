/**
 * City aliases used for deterministic target-city matching. A preference city is
 * matched against the event's city, venue and title text using these aliases.
 * Unknown cities fall back to the city name itself.
 */
const CITY_ALIASES: Record<string, string[]> = {
  bengaluru: ["bengaluru", "bangalore", "blr"],
  mumbai: ["mumbai", "bombay", "navi mumbai", "thane"],
  "delhi ncr": ["delhi", "new delhi", "ncr", "gurugram", "gurgaon", "noida", "greater noida", "ghaziabad", "faridabad"],
  delhi: ["delhi", "new delhi"],
  hyderabad: ["hyderabad", "secunderabad"],
  chennai: ["chennai", "madras"],
  kolkata: ["kolkata", "calcutta"],
  pune: ["pune"],
  ahmedabad: ["ahmedabad", "gandhinagar", "gift city"],
};

export function normalizeCity(city: string): string {
  return city.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Canonical city key, so "Bangalore" and "Bengaluru, KA" compare equal. */
export function canonicalCity(city: string): string {
  const key = normalizeCity(city).split(/[,|(]/)[0].trim();
  if (CITY_ALIASES[key]) return key;
  for (const [canon, aliases] of Object.entries(CITY_ALIASES)) {
    if (canon !== "delhi ncr" && aliases.includes(key)) return canon;
  }
  return CITY_ALIASES["delhi ncr"].includes(key) ? "delhi ncr" : key;
}

export function cityAliases(city: string): string[] {
  const key = normalizeCity(city);
  return CITY_ALIASES[key] ?? [key];
}

function containsWord(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i").test(haystack);
}

/** Returns the preference city that the event location matches, or null. */
export function matchTargetCity(
  location: { city: string | null; venue: string | null },
  targetCities: string[],
): string | null {
  const text = [location.city, location.venue].filter(Boolean).join(" | ").toLowerCase();
  if (!text) return null;
  for (const target of targetCities) {
    if (cityAliases(target).some((alias) => containsWord(text, alias))) return target;
  }
  return null;
}

/** Slugs for public listing pages that are organised by city. */
export const LUMA_CITY_SLUGS: Record<string, string> = {
  bengaluru: "bengaluru",
  mumbai: "mumbai",
  "delhi ncr": "new-delhi",
  delhi: "new-delhi",
  hyderabad: "hyderabad",
  chennai: "chennai",
  pune: "pune",
  kolkata: "kolkata",
};

export const ALLEVENTS_CITY_SLUGS: Record<string, string> = {
  bengaluru: "bangalore",
  mumbai: "mumbai",
  "delhi ncr": "new-delhi",
  delhi: "new-delhi",
  hyderabad: "hyderabad",
  chennai: "chennai",
  pune: "pune",
  kolkata: "kolkata",
  ahmedabad: "ahmedabad",
};

export function citySlug(city: string, table: Record<string, string>): string {
  const key = normalizeCity(city);
  return table[key] ?? key.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

import "server-only";

/**
 * Polite, bounded HTTP fetching for public pages:
 * - http(s) only, no private/loopback hosts (URLs come from search results, so guard against SSRF)
 * - login-walled social networks are never fetched (search snippets only)
 * - robots.txt is honoured for the generic user-agent
 * - hard timeout and response-size cap
 */

export const USER_AGENT = "IndustryEventScout/1.0 (+https://github.com; event-digest research prototype)";

const BLOCKED_HOSTS = [
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "threads.net",
  "news.google.com",
];

export function isLoginWalled(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BLOCKED_HOSTS.some((b) => host === b || host.endsWith(`.${b}`));
  } catch {
    return true;
  }
}

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return true;
  if (/^\[?::1\]?$/.test(h) || h.startsWith("[fc") || h.startsWith("[fd") || h.startsWith("[fe80")) return true;
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

export function isFetchableUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (isPrivateHost(u.hostname)) return false;
    return !isLoginWalled(url);
  } catch {
    return false;
  }
}

async function rawFetch(url: string, timeoutMs: number, maxBytes: number, accept: string): Promise<{ status: number; text: string; finalUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept, "accept-language": "en-IN,en;q=0.8" },
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });
    if (isPrivateHost(new URL(res.url || url).hostname)) throw new Error("Redirected to a disallowed host");
    const reader = res.body?.getReader();
    if (!reader) return { status: res.status, text: "", finalUrl: res.url || url };
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    const buf = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
    let offset = 0;
    for (const c of chunks) {
      buf.set(c, offset);
      offset += c.byteLength;
    }
    return { status: res.status, text: new TextDecoder("utf-8").decode(buf), finalUrl: res.url || url };
  } finally {
    clearTimeout(timer);
  }
}

// ---- robots.txt (generic user-agent rules only) ----

const robotsCache = new Map<string, Promise<string[]>>();

function parseRobots(txt: string): string[] {
  const disallow: string[] = [];
  let applies = false;
  let lastWasAgent = false;
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      const isStar = value === "*" || value.toLowerCase().startsWith("industryeventscout");
      applies = lastWasAgent ? applies || isStar : isStar;
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (applies && key === "disallow" && value) disallow.push(value);
  }
  return disallow;
}

function robotsPatternMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const regex = new RegExp(`^${body.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}${anchored ? "$" : ""}`);
  return regex.test(path);
}

export async function robotsAllows(url: string): Promise<boolean> {
  try {
    const u = new URL(url);
    const origin = u.origin;
    if (!robotsCache.has(origin)) {
      robotsCache.set(
        origin,
        rawFetch(`${origin}/robots.txt`, 5000, 200_000, "text/plain")
          .then((r) => (r.status >= 200 && r.status < 300 ? parseRobots(r.text) : []))
          .catch(() => []),
      );
    }
    const rules = await robotsCache.get(origin)!;
    const path = `${u.pathname}${u.search}`;
    return !rules.some((rule) => robotsPatternMatches(rule, path));
  } catch {
    return false;
  }
}

export type PageResult = { ok: true; html: string; finalUrl: string } | { ok: false; reason: string };

export async function fetchPublicPage(url: string, timeoutMs = 9000): Promise<PageResult> {
  if (!isFetchableUrl(url)) return { ok: false, reason: "URL not fetchable (login-walled or non-public host)" };
  if (!(await robotsAllows(url))) return { ok: false, reason: "Disallowed by robots.txt" };
  try {
    const r = await rawFetch(url, timeoutMs, 3_000_000, "text/html,application/xhtml+xml");
    if (r.status < 200 || r.status >= 300) return { ok: false, reason: `HTTP ${r.status}` };
    return { ok: true, html: r.text, finalUrl: r.finalUrl };
  } catch (err) {
    return { ok: false, reason: err instanceof Error && err.name === "AbortError" ? "Timed out" : "Network error" };
  }
}

export async function fetchText(url: string, timeoutMs = 9000, accept = "*/*"): Promise<PageResult> {
  // Used for feeds/APIs (not login-walled pages), so only the SSRF guard applies.
  try {
    const u = new URL(url);
    if ((u.protocol !== "https:" && u.protocol !== "http:") || isPrivateHost(u.hostname)) {
      return { ok: false, reason: "URL not fetchable" };
    }
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }
  try {
    const r = await rawFetch(url, timeoutMs, 3_000_000, accept);
    if (r.status < 200 || r.status >= 300) return { ok: false, reason: `HTTP ${r.status}` };
    return { ok: true, html: r.text, finalUrl: r.finalUrl };
  } catch (err) {
    return { ok: false, reason: err instanceof Error && err.name === "AbortError" ? "Timed out" : "Network error" };
  }
}

/** Run async tasks with bounded concurrency. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

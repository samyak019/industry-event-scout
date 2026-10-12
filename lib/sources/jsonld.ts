import "server-only";
import * as cheerio from "cheerio";
import type { EventRecord } from "../types";
import { buildEventRecord, cleanText, cleanUrl } from "../processing/normalize";

/**
 * Deterministic extraction of schema.org Event objects embedded as JSON-LD in
 * public event pages (organiser sites, Luma, AllEvents, Konfhub, Eventbrite pages…).
 * Only fields present in the markup are used; nothing is inferred.
 */

type Json = Record<string, unknown>;

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function isEventType(t: unknown): boolean {
  return asArray(t as string | string[]).some((x) => typeof x === "string" && /Event$/.test(x) && x !== "EventSeries");
}

function collectEvents(node: unknown, out: Json[], depth = 0) {
  if (!node || typeof node !== "object" || depth > 6) return;
  if (Array.isArray(node)) {
    for (const n of node) collectEvents(n, out, depth + 1);
    return;
  }
  const obj = node as Json;
  if (isEventType(obj["@type"])) {
    out.push(obj);
    return;
  }
  for (const key of ["@graph", "itemListElement", "item", "mainEntity", "subEvent", "event", "events"]) {
    if (key in obj) collectEvents(obj[key], out, depth + 1);
  }
}

function nameOf(v: unknown): string | null {
  if (typeof v === "string") return v;
  for (const item of asArray(v as Json | Json[])) {
    if (item && typeof item === "object" && typeof (item as Json).name === "string") return (item as Json).name as string;
  }
  return null;
}

function parseLocation(loc: unknown): { city: string | null; venue: string | null; virtual: boolean; physical: boolean } {
  let city: string | null = null;
  const venueParts: string[] = [];
  let virtual = false;
  let physical = false;
  for (const l of asArray(loc as Json | Json[] | string)) {
    if (typeof l === "string") {
      venueParts.push(l);
      physical = true;
      continue;
    }
    if (!l || typeof l !== "object") continue;
    const type = String(l["@type"] ?? "");
    if (type === "VirtualLocation") {
      virtual = true;
      continue;
    }
    physical = true;
    if (typeof l.name === "string") venueParts.push(l.name);
    const addr = l.address;
    if (typeof addr === "string") venueParts.push(addr);
    else if (addr && typeof addr === "object") {
      const a = addr as Json;
      if (typeof a.addressLocality === "string") city = a.addressLocality;
      const street = [a.streetAddress, a.addressLocality, a.addressRegion].filter((x) => typeof x === "string").join(", ");
      if (street) venueParts.push(street);
    }
  }
  const venue = [...new Set(venueParts.map((v) => v.trim()).filter(Boolean))].join(" — ") || null;
  return { city, venue, virtual, physical };
}

function parseOffers(offers: unknown, base: string): { url: string | null; validThrough: string | null } {
  for (const o of asArray(offers as Json | Json[])) {
    if (!o || typeof o !== "object") continue;
    const url = cleanUrl(o.url, base);
    const validThrough = typeof o.validThrough === "string" ? o.validThrough : null;
    if (url || validThrough) return { url, validThrough };
  }
  return { url: null, validThrough: null };
}

export function extractJsonLdEvents(
  html: string,
  pageUrl: string,
  sourceName: string,
  retrievedAt: string,
  timeZone: string,
): EventRecord[] {
  const $ = cheerio.load(html);
  const raw: Json[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).contents().text();
    try {
      collectEvents(JSON.parse(text), raw);
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  });

  const host = (() => {
    try {
      return new URL(pageUrl).hostname.replace(/^www\./, "");
    } catch {
      return sourceName;
    }
  })();

  const events: EventRecord[] = [];
  for (const ev of raw) {
    const loc = parseLocation(ev.location);
    const mode = String(ev.eventAttendanceMode ?? "");
    let isOnline: boolean | null = null;
    if (/Online/i.test(mode) && !loc.physical) isOnline = true;
    else if (/Offline/i.test(mode) || loc.physical) isOnline = false;
    else if (loc.virtual) isOnline = true;

    const offers = parseOffers(ev.offers, pageUrl);
    const eventUrl = cleanUrl(ev.url, pageUrl) ?? pageUrl;
    const record = buildEventRecord(
      {
        title: ev.name,
        description: typeof ev.description === "string" ? cleanText(ev.description, 1500) : null,
        organizer: nameOf(ev.organizer),
        start: ev.startDate,
        end: ev.endDate,
        city: loc.city,
        venue: loc.venue,
        is_online: isOnline,
        event_url: eventUrl,
        registration_url: offers.url && offers.url !== eventUrl ? offers.url : null,
        registration_deadline: offers.validThrough,
        deadline_source: `schema.org offers.validThrough on ${host}`,
        event_status: ev.eventStatus,
        source_name: sourceName,
        source_url: eventUrl === pageUrl ? pageUrl : eventUrl,
        retrieved_at: retrievedAt,
        extraction_method: "json-ld",
        data_notes: eventUrl !== pageUrl ? [`Listed on ${pageUrl}`] : [],
      },
      timeZone,
    );
    if (record) events.push(record);
  }
  return events;
}

/** Visible page text for grounded AI extraction when no JSON-LD is present. */
export function extractPageText(html: string, maxLen = 3500): { title: string | null; text: string } {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, nav, footer, header, form, iframe").remove();
  const title = cleanText($("meta[property='og:title']").attr("content") ?? $("title").first().text(), 300);
  const desc = cleanText($("meta[name='description']").attr("content") ?? "", 600) ?? "";
  const main = $("main").length ? $("main").text() : $("body").text();
  const text = cleanText(`${desc} ${main}`, maxLen) ?? "";
  return { title, text };
}

import { describe, expect, it } from "vitest";
import { classifyEvent, windowCheck } from "@/lib/processing/filter";
import { DAY_MS } from "@/lib/time";
import { buildEventRecord } from "@/lib/processing/normalize";
import { NOW, TZ, ev, prefs } from "./helpers";

const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

describe("30-day window", () => {
  it("includes timed events between now and now+30d inclusive", () => {
    expect(windowCheck({ start_at: at(0), date_only: false, event_date: null }, NOW, TZ)).toBe("in_window");
    expect(windowCheck({ start_at: at(30 * DAY_MS), date_only: false, event_date: null }, NOW, TZ)).toBe("in_window");
  });
  it("excludes events just outside the window", () => {
    expect(windowCheck({ start_at: at(30 * DAY_MS + 1), date_only: false, event_date: null }, NOW, TZ)).toBe("beyond");
    expect(windowCheck({ start_at: at(-1), date_only: false, event_date: null }, NOW, TZ)).toBe("past");
  });
  it("uses local calendar dates for date-only events", () => {
    // NOW is 12 Oct 2026 10:00 IST; window end is 11 Nov 2026 10:00 IST.
    const today = buildEventRecord({ title: "Today", start: "2026-10-12", event_url: "https://a.com/x", source_name: "t", source_url: "https://a.com/x", retrieved_at: NOW.toISOString(), extraction_method: "json-ld" }, TZ)!;
    expect(today.date_only).toBe(true);
    expect(windowCheck(today, NOW, TZ)).toBe("in_window");
    expect(windowCheck({ start_at: "x", date_only: true, event_date: "2026-11-11" }, NOW, TZ)).toBe("in_window");
    expect(windowCheck({ start_at: "x", date_only: true, event_date: "2026-11-12" }, NOW, TZ)).toBe("beyond");
    expect(windowCheck({ start_at: "x", date_only: true, event_date: "2026-10-11" }, NOW, TZ)).toBe("past");
  });
  it("reports unknown when there is no start date", () => {
    expect(windowCheck({ start_at: null, date_only: false, event_date: null }, NOW, TZ)).toBe("unknown");
  });
});

describe("classification rules", () => {
  const p = prefs();
  it("marks a matching in-window event actionable", () => {
    expect(classifyEvent(ev(), p, NOW).bucket).toBe("actionable");
  });
  it("matches city aliases (Bangalore = Bengaluru, Gurugram in Delhi NCR)", () => {
    expect(classifyEvent(ev({ city: "Bangalore" }), p, NOW).bucket).toBe("actionable");
    expect(classifyEvent(ev({ city: "Gurugram" }), p, NOW).bucket).toBe("actionable");
  });
  it("excludes other cities and respects the online preference", () => {
    expect(classifyEvent(ev({ city: "Chennai" }), p, NOW).bucket).toBe("excluded");
    expect(classifyEvent(ev({ city: null, is_online: true }), p, NOW).bucket).toBe("excluded");
    expect(classifyEvent(ev({ city: null, is_online: true }), prefs({ allow_online_events: true }), NOW).bucket).toBe("actionable");
  });
  it("puts events with unknown date or location into needs_verification", () => {
    expect(classifyEvent(ev({ start_at: null, event_date: null }), p, NOW).bucket).toBe("needs_verification");
    expect(classifyEvent(ev({ city: null, venue: null, is_online: null }), p, NOW).bucket).toBe("needs_verification");
  });
  it("enforces the domain policy and relevance threshold in code", () => {
    expect(classifyEvent(ev({ matched_domains: [] }), p, NOW).bucket).toBe("excluded");
    expect(classifyEvent(ev({ matched_domains: ["Crypto"] }), p, NOW).bucket).toBe("excluded");
    expect(classifyEvent(ev({ relevance_score: 39 }), p, NOW).bucket).toBe("excluded");
    expect(classifyEvent(ev({ relevance_score: 40 }), p, NOW).bucket).toBe("actionable");
  });
  it("excludes a known format outside the selected categories but keeps unknown formats", () => {
    expect(classifyEvent(ev({ format: "hackathon", categories: [] }), p, NOW).bucket).toBe("excluded");
    expect(classifyEvent(ev({ format: null, categories: [] }), p, NOW).bucket).toBe("actionable");
  });
  it("handles cancelled events and closed registration separately", () => {
    expect(classifyEvent(ev({ event_status: "cancelled" }), p, NOW).bucket).toBe("excluded");
    expect(classifyEvent(ev({ registration_deadline: at(-DAY_MS) }), p, NOW).bucket).toBe("closed");
  });
  it("excludes past and far-future events", () => {
    expect(classifyEvent(ev({ start_at: at(-DAY_MS) }), p, NOW).bucket).toBe("excluded");
    expect(classifyEvent(ev({ start_at: at(31 * DAY_MS) }), p, NOW).bucket).toBe("excluded");
  });
});

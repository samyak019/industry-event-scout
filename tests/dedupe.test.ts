import { describe, expect, it } from "vitest";
import { dedupeEvents, isSameEvent } from "@/lib/processing/dedupe";
import { normalizeUrlKey } from "@/lib/processing/normalize";
import { ev } from "./helpers";

describe("deduplication", () => {
  it("normalizes URLs (tracking params, www, trailing slash, lu.ma alias)", () => {
    expect(normalizeUrlKey("https://www.Example.com/e/1/?utm_source=x&id=2")).toBe("example.com/e/1?id=2");
    expect(normalizeUrlKey("https://lu.ma/abc")).toBe(normalizeUrlKey("https://luma.com/abc/"));
  });
  it("merges the same event found via two sources and keeps both source URLs", () => {
    const a = ev({ event_url: "https://luma.com/abc", source_name: "Luma", sources: [{ source_name: "Luma", source_url: "https://luma.com/abc", discovered_at: "x" }] });
    const b = ev({ event_url: "https://lu.ma/abc?utm_source=tavily", source_name: "Tavily", sources: [{ source_name: "Tavily", source_url: "https://lu.ma/abc?utm_source=tavily", discovered_at: "x" }], registration_deadline: "2026-10-15T00:00:00.000Z" });
    const out = dedupeEvents([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].sources.map((s) => s.source_name).sort()).toEqual(["Luma", "Tavily"]);
    expect(out[0].registration_deadline).toBe("2026-10-15T00:00:00.000Z");
  });
  it("merges near-identical titles on the same date in the same city", () => {
    const a = ev({ title: "SaaS Leaders Summit 2026", event_url: "https://a.com/1" });
    const b = ev({ title: "SaaS Leaders Summit", event_url: "https://b.com/2" });
    expect(isSameEvent(a, b)).toBe(true);
  });
  it("never merges editions on different dates", () => {
    const a = ev({ title: "CIO Roundtable", event_url: "https://a.com/1", event_date: "2026-10-20" });
    const b = ev({ title: "CIO Roundtable", event_url: "https://a.com/2", event_date: "2026-11-03" });
    const c = ev({ title: "CIO Roundtable", event_url: "https://a.com/1", event_date: "2026-11-03" });
    expect(isSameEvent(a, b)).toBe(false);
    expect(isSameEvent(a, c)).toBe(false);
    expect(dedupeEvents([a, b, c])).toHaveLength(2);
  });
  it("keeps different events on the same date apart", () => {
    expect(isSameEvent(ev({ title: "Fintech Founders Mixer" }), ev({ title: "Cloud Security CXO Roundtable" }))).toBe(false);
  });
});

describe("city aliases in dedupe", () => {
  it("merges the same event listed under Bangalore and Bengaluru", () => {
    const a = ev({ title: "Founder Talks by CEDAT", city: "Bengaluru", event_url: "https://allevents.in/bengaluru/x/1" });
    const b = ev({ title: "Founder Talks by CEDAT", city: "Bangalore", event_url: "https://allevents.in/bangalore/x/2" });
    expect(dedupeEvents([a, b])).toHaveLength(1);
  });
  it("does not merge same-titled events in different cities", () => {
    const a = ev({ title: "Startup Pitches", city: "Mumbai", event_url: "https://a.com/1" });
    const b = ev({ title: "Startup Pitches", city: "Bengaluru", event_url: "https://a.com/2" });
    expect(dedupeEvents([a, b])).toHaveLength(2);
  });
});

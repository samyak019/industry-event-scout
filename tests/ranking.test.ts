import { describe, expect, it } from "vitest";
import { classifyEvent } from "@/lib/processing/filter";
import { rankEvents, selectDigestEvents } from "@/lib/processing/rank";
import { DAY_MS } from "@/lib/time";
import { NOW, ev, prefs } from "./helpers";

const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();
const c = (o: Parameters<typeof ev>[0]) => classifyEvent(ev(o), prefs(), NOW);

describe("ranking", () => {
  it("sorts by relevance first; urgency does not override relevance", () => {
    const high = c({ title: "High", relevance_score: 90 });
    const urgentLow = c({ title: "UrgentLow", relevance_score: 60, registration_deadline: at(2 * DAY_MS) });
    expect(rankEvents([urgentLow, high]).map((e) => e.title)).toEqual(["High", "UrgentLow"]);
  });
  it("breaks score ties with urgency, then start date", () => {
    const a = c({ title: "A", relevance_score: 70, start_at: at(5 * DAY_MS) });
    const b = c({ title: "B", relevance_score: 70, start_at: at(2 * DAY_MS) });
    const u = c({ title: "U", relevance_score: 70, start_at: at(9 * DAY_MS), registration_deadline: at(3 * DAY_MS) });
    expect(rankEvents([a, b, u]).map((e) => e.title)).toEqual(["U", "B", "A"]);
  });
  it("digest keeps urgent events beyond the size limit", () => {
    const many = Array.from({ length: 5 }, (_, i) => c({ title: `E${i}`, relevance_score: 90 - i }));
    const urgent = c({ title: "Urgent", relevance_score: 45, registration_deadline: at(DAY_MS) });
    const picked = selectDigestEvents([...many, urgent], 3);
    expect(picked.map((e) => e.title)).toEqual(["E0", "E1", "E2", "Urgent"]);
  });
  it("digest only includes actionable events", () => {
    const excluded = c({ title: "X", city: "Chennai" });
    expect(selectDigestEvents([excluded], 10)).toHaveLength(0);
  });
});

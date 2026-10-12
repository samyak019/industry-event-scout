import { describe, expect, it, vi } from "vitest";
import { GeminiSession, assessEvents, groundExtraction } from "@/lib/ai/gemini";
import type { Extraction } from "@/lib/ai/schemas";
import type { RawCandidate } from "@/lib/types";
import { NOW, TZ, ev, prefs } from "./helpers";

const candidate: RawCandidate = {
  source_name: "Tavily search",
  source_url: "https://organiser.example/cio-roundtable",
  retrieved_at: NOW.toISOString(),
  title: "Bengaluru CIO Roundtable",
  snippet: "",
  fetchable: true,
};
const text =
  "Bengaluru CIO Roundtable. Join 30 CIOs on 5th November 2026, 6:30 PM at Taj West End, Bengaluru. Registrations close on 1 November 2026. Register: https://organiser.example/register";

const base: Extraction = {
  id: "0",
  is_event: true,
  title: "Bengaluru CIO Roundtable",
  start_date: "2026-11-05",
  start_time: "18:30",
  end_date: null,
  date_evidence: "5th November 2026, 6:30 PM",
  city: "Bengaluru",
  venue: "Taj West End",
  is_online: false,
  organizer: null,
  registration_deadline: "2026-11-01",
  deadline_evidence: "Registrations close on 1 November 2026",
  registration_url: "https://organiser.example/register",
};

describe("grounded extraction", () => {
  it("keeps fields that are supported by verbatim source quotes", () => {
    const r = groundExtraction(base, { candidate, text }, TZ)!;
    expect(r.start_at).toBe("2026-11-05T13:00:00.000Z");
    expect(r.city).toBe("Bengaluru");
    expect(r.registration_deadline).toBe("2026-11-01T18:29:59.999Z");
    expect(r.registration_url).toBe("https://organiser.example/register");
    expect(r.extraction_method).toBe("gemini-grounded");
  });
  it("drops hallucinated dates, deadlines, URLs and cities", () => {
    const r = groundExtraction(
      {
        ...base,
        start_date: "2026-11-06",
        registration_deadline: "2026-11-05",
        deadline_evidence: "5th November 2026", // the event date, not a deadline
        registration_url: "https://evil.example/pay",
        city: "Mumbai",
      },
      { candidate, text },
      TZ,
    )!;
    expect(r.start_at).toBeNull();
    expect(r.registration_deadline).toBeNull();
    expect(r.registration_url).toBeNull();
    expect(r.city).toBeNull();
    expect(r.data_notes.join(" ")).toMatch(/rejected/);
  });
});

describe("Gemini assessment handling", () => {
  it("restricts model-returned domains/categories to the user's lists", async () => {
    const s = new GeminiSession(Date.now() + 60000);
    Object.defineProperty(s, "usable", { get: () => true });
    vi.spyOn(s, "generateJson").mockResolvedValue({
      assessments: [
        { id: "0", matched_domains: ["saas", "Blockchain"], categories: ["roundtables", "Hackathons"], format: "Roundtable", relevance_score: 88, match_reason: "CIO audience", summary: "A roundtable.", audience: null },
      ],
    } as never);
    const e = ev();
    const out = await assessEvents(s, [e], prefs());
    const a = out.get(e.dedupe_key)!;
    expect(a.matched_domains).toEqual(["SaaS"]);
    expect(a.categories).toEqual(["Roundtables"]);
    expect(a.assessment_method).toBe("gemini");
  });
  it("returns no assessment (caller falls back to rules) when Gemini fails", async () => {
    const s = new GeminiSession(Date.now() + 60000);
    Object.defineProperty(s, "usable", { get: () => true });
    vi.spyOn(s, "generateJson").mockResolvedValue(null);
    const out = await assessEvents(s, [ev()], prefs());
    expect(out.size).toBe(0);
  });
  it("reports not_configured without an API key", () => {
    delete process.env.GEMINI_API_KEY;
    expect(new GeminiSession(Date.now()).status().status).toBe("not_configured");
  });
});

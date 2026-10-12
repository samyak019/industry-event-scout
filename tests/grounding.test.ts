import { describe, expect, it } from "vitest";
import { evidenceInSource, evidenceSupportsDate } from "@/lib/ai/grounding";
import { AssessmentResponse } from "@/lib/ai/schemas";

describe("grounding of AI-extracted dates", () => {
  const text = "Join the CIO Roundtable on 5th November 2026 at Taj MG Road. Registrations close on Nov 1, 2026.";
  it("accepts a verbatim quote that supports the date", () => {
    expect(evidenceInSource("5th November 2026", text)).toBe(true);
    expect(evidenceSupportsDate("5th November 2026", "2026-11-05")).toBe(true);
    expect(evidenceSupportsDate("Registrations close on Nov 1, 2026", "2026-11-01")).toBe(true);
    expect(evidenceSupportsDate("on 05/11/2026", "2026-11-05")).toBe(true);
    expect(evidenceSupportsDate("on 05.11.2026", "2026-11-05")).toBe(true);
  });
  it("rejects invented quotes or quotes that do not support the date", () => {
    expect(evidenceInSource("6th November 2026", text)).toBe(false);
    expect(evidenceSupportsDate("5th November 2026", "2026-11-06")).toBe(false);
    expect(evidenceSupportsDate("5th November 2025", "2026-11-05")).toBe(false);
    expect(evidenceSupportsDate(null, "2026-11-05")).toBe(false);
  });
});

describe("Gemini output validation", () => {
  it("accepts valid structured output and clamps text", () => {
    const r = AssessmentResponse.safeParse({ assessments: [{ id: "0", matched_domains: ["SaaS"], categories: [], format: null, relevance_score: 72.4, match_reason: "x", summary: "y", audience: null }] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.assessments[0].relevance_score).toBe(72);
  });
  it("rejects out-of-range or malformed output", () => {
    expect(AssessmentResponse.safeParse({ assessments: [{ id: "0", relevance_score: 140, match_reason: "x", summary: "y" }] }).success).toBe(false);
    expect(AssessmentResponse.safeParse({ foo: 1 }).success).toBe(false);
  });
});

describe("time-of-day is not a day of month", () => {
  it("does not read 6:30 PM as the 6th", () => {
    expect(evidenceSupportsDate("5th November 2026, 6:30 PM", "2026-11-06")).toBe(false);
    expect(evidenceSupportsDate("5th November 2026, 6 pm", "2026-11-06")).toBe(false);
    expect(evidenceSupportsDate("5th November 2026, 6:30 PM", "2026-11-05")).toBe(true);
  });
});

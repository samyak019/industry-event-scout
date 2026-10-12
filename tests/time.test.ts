import { describe, expect, it } from "vitest";
import { parseSourceDate, zonedToUtc } from "@/lib/time";
import { buildEventRecord } from "@/lib/processing/normalize";

describe("time-zone handling", () => {
  it("interprets date-only values as local midnight in the given zone", () => {
    expect(zonedToUtc(2026, 11, 5, 0, 0, 0, 0, "Asia/Kolkata").toISOString()).toBe("2026-11-04T18:30:00.000Z");
    const p = parseSourceDate("2026-11-05", "Asia/Kolkata")!;
    expect(p.dateOnly).toBe(true);
    expect(p.date).toBe("2026-11-05");
  });
  it("keeps explicit offsets exact", () => {
    expect(parseSourceDate("2026-10-14T08:30:00.000+05:30", "UTC")!.instant.toISOString()).toBe("2026-10-14T03:00:00.000Z");
  });
  it("rejects free-text dates rather than guessing", () => {
    expect(parseSourceDate("next Thursday", "Asia/Kolkata")).toBeNull();
  });
  it("treats a date-only deadline as the end of that local day", () => {
    const r = buildEventRecord(
      { title: "Event", start: "2026-11-05", registration_deadline: "2026-11-01", event_url: "https://a.com/e", source_name: "t", source_url: "https://a.com/e", retrieved_at: "2026-10-12T00:00:00.000Z", extraction_method: "json-ld" },
      "Asia/Kolkata",
    )!;
    expect(r.registration_deadline).toBe("2026-11-01T18:29:59.999Z");
  });
  it("rejects records without a usable URL or title", () => {
    expect(buildEventRecord({ title: "", event_url: "https://a.com", source_name: "t", source_url: "https://a.com", retrieved_at: "x", extraction_method: "json-ld" }, "UTC")).toBeNull();
    expect(buildEventRecord({ title: "Valid", event_url: "javascript:alert(1)", source_name: "t", source_url: "ftp://x", retrieved_at: "x", extraction_method: "json-ld" }, "UTC")).toBeNull();
  });
});

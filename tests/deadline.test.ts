import { describe, expect, it } from "vitest";
import { deadlineStatus } from "@/lib/processing/deadline";
import { DAY_MS } from "@/lib/time";
import { NOW } from "./helpers";

const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

describe("deadline rule (< 7 days is urgent)", () => {
  it("flags a deadline fewer than seven days away", () => {
    expect(deadlineStatus(at(3 * DAY_MS), NOW).status).toBe("urgent");
    expect(deadlineStatus(at(7 * DAY_MS - 1), NOW).status).toBe("urgent");
    expect(deadlineStatus(at(60 * 1000), NOW).status).toBe("urgent");
  });
  it("does NOT flag a deadline exactly seven days away", () => {
    expect(deadlineStatus(at(7 * DAY_MS), NOW).status).toBe("open");
  });
  it("treats later deadlines as open", () => {
    expect(deadlineStatus(at(10 * DAY_MS), NOW).status).toBe("open");
  });
  it("marks passed deadlines as closed (including exactly now)", () => {
    expect(deadlineStatus(at(-1), NOW).status).toBe("closed");
    expect(deadlineStatus(at(0), NOW).status).toBe("closed");
  });
  it("reports unknown deadlines as unknown, never inferred", () => {
    const d = deadlineStatus(null, NOW);
    expect(d.status).toBe("unknown");
    expect(d.label).toMatch(/not listed/i);
    expect(deadlineStatus("not a date", NOW).status).toBe("unknown");
  });
});

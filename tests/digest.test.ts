import { describe, expect, it } from "vitest";
import { buildDigest } from "@/lib/email/render-digest";
import { classifyEvent } from "@/lib/processing/filter";
import { DAY_MS } from "@/lib/time";
import { NOW, ev, prefs } from "./helpers";

describe("digest renderer", () => {
  it("escapes untrusted event text and flags urgent deadlines", () => {
    const e = classifyEvent(
      ev({ title: `<script>alert(1)</script> CIO Meet`, registration_deadline: new Date(NOW.getTime() + 2 * DAY_MS).toISOString(), registration_url: "https://example.com/reg" }),
      prefs(),
      NOW,
    );
    const d = buildDigest([e], prefs(), NOW, "https://scout.example");
    expect(d.html).not.toContain("<script>alert(1)</script>");
    expect(d.html).toContain("&lt;script&gt;");
    expect(d.html).toContain("Registration closes in 2 days");
    expect(d.html).toContain("https://example.com/reg");
    expect(d.urgentCount).toBe(1);
  });
  it("produces an honest empty digest", () => {
    const d = buildDigest([], prefs(), NOW, "https://scout.example");
    expect(d.subject).toMatch(/No matching events/);
    expect(d.events).toHaveLength(0);
  });
  it("shows 'Deadline not listed' when the deadline is unknown", () => {
    const d = buildDigest([classifyEvent(ev(), prefs(), NOW)], prefs(), NOW, "https://x");
    expect(d.html).toContain("Deadline not listed");
  });
});

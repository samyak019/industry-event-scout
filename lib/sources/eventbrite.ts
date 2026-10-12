import "server-only";
import { z } from "zod";
import { env } from "../env";
import type { EventRecord } from "../types";
import type { SourceAdapter } from "./types";
import { buildEventRecord } from "../processing/normalize";

/**
 * Optional Eventbrite adapter. Eventbrite's public event *search* API was retired,
 * so this only lists live events of specific organisers (EVENTBRITE_ORGANIZER_IDS)
 * using a free personal OAuth token. Disabled unless both variables are set.
 */

const EbEvent = z.object({
  name: z.object({ text: z.string().nullable() }).nullable(),
  description: z.object({ text: z.string().nullable() }).nullable().optional(),
  url: z.string(),
  start: z.object({ utc: z.string(), timezone: z.string().optional() }),
  end: z.object({ utc: z.string() }).nullable().optional(),
  online_event: z.boolean().optional(),
  status: z.string().optional(),
  venue: z
    .object({
      name: z.string().nullable().optional(),
      address: z.object({ city: z.string().nullable().optional(), localized_address_display: z.string().nullable().optional() }).nullable().optional(),
    })
    .nullable()
    .optional(),
  organizer: z.object({ name: z.string().nullable().optional() }).nullable().optional(),
});

export const eventbriteAdapter: SourceAdapter = {
  name: "Eventbrite API (optional)",
  async run(ctx) {
    const token = env.eventbriteToken();
    const orgIds = env.eventbriteOrganizerIds();
    if (!token || !orgIds.length) {
      return { candidates: [], status: "disabled", message: "Optional: set EVENTBRITE_API_TOKEN and EVENTBRITE_ORGANIZER_IDS to enable" };
    }
    const events: EventRecord[] = [];
    const errors: string[] = [];
    for (const id of orgIds.slice(0, 10)) {
      try {
        const res = await fetch(
          `https://www.eventbriteapi.com/v3/organizers/${encodeURIComponent(id)}/events/?status=live&order_by=start_asc&expand=venue,organizer`,
          { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000), cache: "no-store" },
        );
        if (!res.ok) {
          errors.push(`organizer ${id}: HTTP ${res.status}`);
          continue;
        }
        const body = (await res.json()) as { events?: unknown[] };
        for (const raw of body.events ?? []) {
          const p = EbEvent.safeParse(raw);
          if (!p.success) continue;
          const e = p.data;
          const rec = buildEventRecord(
            {
              title: e.name?.text,
              description: e.description?.text,
              organizer: e.organizer?.name,
              start: e.start.utc,
              end: e.end?.utc,
              timezone: e.start.timezone ?? null,
              city: e.venue?.address?.city,
              venue: [e.venue?.name, e.venue?.address?.localized_address_display].filter(Boolean).join(" — "),
              is_online: e.online_event ?? null,
              event_url: e.url,
              registration_url: e.url,
              event_status: e.status,
              source_name: "Eventbrite API",
              source_url: e.url,
              retrieved_at: ctx.retrievedAt,
              extraction_method: "eventbrite-api",
            },
            ctx.prefs.timezone,
          );
          if (rec) events.push(rec);
        }
      } catch {
        errors.push(`organizer ${id}: network error`);
      }
    }
    if (!events.length && errors.length) throw new Error(errors.join("; "));
    return {
      candidates: [
        {
          source_name: "Eventbrite API",
          source_url: "https://www.eventbriteapi.com/v3/",
          retrieved_at: ctx.retrievedAt,
          title: "Eventbrite organiser events",
          snippet: "",
          structured: events,
          fetchable: false,
        },
      ],
      status: errors.length ? "partial" : "ok",
      message: `${events.length} event(s) from ${orgIds.length} organiser(s)${errors.length ? `; ${errors.join("; ")}` : ""}`,
    };
  },
};

import { z } from "zod";

/** Gemini output for relevance assessment. Treated as model opinion, never as fact. */
export const AssessmentItem = z.object({
  id: z.string(),
  matched_domains: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  format: z.string().nullable().default(null),
  relevance_score: z.number().min(0).max(100).transform((n) => Math.round(n)),
  match_reason: z.string().min(1).transform((s) => s.slice(0, 280)),
  summary: z.string().min(1).transform((s) => s.slice(0, 360)),
  audience: z.string().nullable().default(null),
});
export const AssessmentResponse = z.object({ assessments: z.array(AssessmentItem) });
export type Assessment = z.infer<typeof AssessmentItem>;

/** Gemini output for grounded extraction from unstructured text. */
export const ExtractionItem = z.object({
  id: z.string(),
  is_event: z.boolean(),
  title: z.string().nullable().default(null),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  start_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  date_evidence: z.string().nullable().default(null),
  city: z.string().nullable().default(null),
  venue: z.string().nullable().default(null),
  is_online: z.boolean().nullable().default(null),
  organizer: z.string().nullable().default(null),
  registration_deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  deadline_evidence: z.string().nullable().default(null),
  registration_url: z.string().nullable().default(null),
});
export const ExtractionResponse = z.object({ events: z.array(ExtractionItem) });
export type Extraction = z.infer<typeof ExtractionItem>;

// Hand-written JSON Schemas for Gemini structured output (kept to the widely supported subset).
const str = { type: "string" };
const nstr = { type: ["string", "null"] };

export const assessmentJsonSchema = {
  type: "object",
  properties: {
    assessments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: str,
          matched_domains: { type: "array", items: str },
          categories: { type: "array", items: str },
          format: nstr,
          relevance_score: { type: "integer", minimum: 0, maximum: 100 },
          match_reason: str,
          summary: str,
          audience: nstr,
        },
        required: ["id", "matched_domains", "categories", "format", "relevance_score", "match_reason", "summary", "audience"],
      },
    },
  },
  required: ["assessments"],
};

export const extractionJsonSchema = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: str,
          is_event: { type: "boolean" },
          title: nstr,
          start_date: nstr,
          start_time: nstr,
          end_date: nstr,
          date_evidence: nstr,
          city: nstr,
          venue: nstr,
          is_online: { type: ["boolean", "null"] },
          organizer: nstr,
          registration_deadline: nstr,
          deadline_evidence: nstr,
          registration_url: nstr,
        },
        required: ["id", "is_event", "title", "start_date", "date_evidence", "city", "is_online", "registration_deadline", "deadline_evidence"],
      },
    },
  },
  required: ["events"],
};

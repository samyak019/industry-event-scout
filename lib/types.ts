export type Preferences = {
  id?: string;
  email: string | null;
  domains: string[];
  cities: string[];
  categories: string[];
  allow_online_events: boolean;
  timezone: string;
  max_digest_events: number;
  min_relevance_score: number;
  rss_feeds: string[];
  extra_source_urls: string[];
  updated_at?: string;
};

export type EventStatus = "scheduled" | "cancelled" | "postponed" | "unknown";
export type ExtractionMethod = "json-ld" | "gemini-grounded" | "eventbrite-api";
export type AssessmentMethod = "gemini" | "rules";

export type EventSourceRef = {
  source_name: string;
  source_url: string;
  discovered_at: string;
};

/** The normalized event record shared by every adapter, the pipeline, the DB and the email. */
export type EventRecord = {
  id?: string;
  dedupe_key: string;
  title: string;
  description: string | null;
  organizer: string | null;
  /** UTC ISO instant. For date-only events this is local midnight in `timezone`. */
  start_at: string | null;
  end_at: string | null;
  /** YYYY-MM-DD, set when the source only provides a date (no time). */
  event_date: string | null;
  date_only: boolean;
  timezone: string | null;
  city: string | null;
  venue: string | null;
  is_online: boolean | null;
  event_url: string;
  registration_url: string | null;
  /** UTC ISO instant; never inferred from the event date. */
  registration_deadline: string | null;
  deadline_source: string | null;
  event_status: EventStatus;
  format: string | null;
  categories: string[];
  matched_domains: string[];
  relevance_score: number | null;
  ai_summary: string | null;
  match_reason: string | null;
  audience: string | null;
  assessment_method: AssessmentMethod | null;
  extraction_method: ExtractionMethod;
  data_notes: string[];
  source_name: string;
  source_url: string;
  source_retrieved_at: string;
  sources: EventSourceRef[];
  first_seen_at?: string;
  last_seen_at?: string;
};

/** Raw output of a source adapter before normalization. */
export type RawCandidate = {
  source_name: string;
  source_url: string;
  retrieved_at: string;
  title: string;
  snippet: string;
  /** Already-normalized events when the source exposes structured data (JSON-LD, API). */
  structured?: EventRecord[];
  /** Whether the pipeline may fetch `source_url` to look for structured data. */
  fetchable: boolean;
};

export type SourceStatus = {
  source: string;
  status: "ok" | "error" | "disabled" | "partial";
  message: string;
  candidates: number;
  events: number;
  duration_ms: number;
};

export type AiStatus = {
  status: "ok" | "partial" | "unavailable" | "not_configured" | "skipped";
  model: string | null;
  calls: number;
  failures: number;
  message: string;
};

export type Bucket = "actionable" | "needs_verification" | "closed" | "excluded";

export type DeadlineStatus = "urgent" | "open" | "closed" | "unknown";

export type DeadlineInfo = {
  status: DeadlineStatus;
  /** Milliseconds until the deadline (negative when passed); null when unknown. */
  msRemaining: number | null;
  label: string;
};

export type ClassifiedEvent = EventRecord & {
  bucket: Bucket;
  reasons: string[];
  deadline: DeadlineInfo;
};

export type TriggerType = "cron" | "manual_refresh" | "test_email";

export type RunCounts = {
  discovered: number;
  normalized: number;
  deduplicated: number;
  actionable: number;
  needs_verification: number;
  emailed: number;
};

export type RunRecord = {
  id: string;
  run_key: string;
  trigger_type: TriggerType;
  status: "running" | "succeeded" | "partial_failure" | "failed" | "skipped";
  counts: RunCounts;
  source_status: SourceStatus[];
  ai_status: AiStatus | null;
  recipient_email: string | null;
  resend_email_id: string | null;
  email_status: "not_attempted" | "sent" | "failed" | "skipped" | null;
  started_at: string;
  finished_at: string | null;
  error_summary: string | null;
};

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
import type { EventRecord, Preferences, RunCounts, RunRecord, TriggerType } from "../types";
import { defaultPreferences } from "./defaults";
import { deadlineStatus } from "../processing/deadline";

/**
 * Persistence layer. Uses Supabase (service role, server only) when configured.
 * Without Supabase it falls back to an in-process memory store that is clearly
 * flagged in the UI as NOT persisted (useful for local development only).
 */

export type CreateRunResult = { created: true; run: RunRecord } | { created: false; run: RunRecord };

export interface Store {
  readonly kind: "supabase" | "memory";
  getPreferences(): Promise<Preferences>;
  savePreferences(p: Preferences): Promise<Preferences>;
  upsertEvents(events: EventRecord[], now: Date): Promise<void>;
  listRecentEvents(since: Date): Promise<EventRecord[]>;
  createRun(runKey: string, trigger: TriggerType, recipient: string | null): Promise<CreateRunResult>;
  /** Re-claim a failed (or stale "running") run with the same key for a retry. Null if not claimable. */
  reclaimFailedRun(runKey: string, staleMs: number): Promise<RunRecord | null>;
  updateRun(id: string, patch: Partial<RunRecord>): Promise<void>;
  listRuns(limit: number): Promise<RunRecord[]>;
  lastRun(trigger: TriggerType): Promise<RunRecord | null>;
}

const emptyCounts = (): RunCounts => ({ discovered: 0, normalized: 0, deduplicated: 0, actionable: 0, needs_verification: 0, emailed: 0 });

// ---------------------------------------------------------------------------
// Memory store (dev fallback)
// ---------------------------------------------------------------------------

type MemoryState = { prefs: Preferences | null; events: Map<string, EventRecord>; runs: RunRecord[] };
const g = globalThis as unknown as { __iesMemory?: MemoryState };
const mem: MemoryState = (g.__iesMemory ??= { prefs: null, events: new Map(), runs: [] });

class MemoryStore implements Store {
  readonly kind = "memory" as const;
  async getPreferences() {
    return mem.prefs ?? defaultPreferences(env.defaultTimezone(), env.digestToEmail() ?? null);
  }
  async savePreferences(p: Preferences) {
    mem.prefs = { ...p, updated_at: new Date().toISOString() };
    return mem.prefs;
  }
  async upsertEvents(events: EventRecord[], now: Date) {
    for (const e of events) {
      const prev = mem.events.get(e.dedupe_key);
      mem.events.set(e.dedupe_key, {
        ...e,
        id: prev?.id ?? crypto.randomUUID(),
        first_seen_at: prev?.first_seen_at ?? now.toISOString(),
        last_seen_at: now.toISOString(),
      });
    }
  }
  async listRecentEvents(since: Date) {
    return [...mem.events.values()].filter((e) => (e.last_seen_at ?? "") >= since.toISOString());
  }
  async createRun(runKey: string, trigger: TriggerType, recipient: string | null): Promise<CreateRunResult> {
    const existing = mem.runs.find((r) => r.run_key === runKey);
    if (existing) return { created: false, run: existing };
    const run: RunRecord = {
      id: crypto.randomUUID(),
      run_key: runKey,
      trigger_type: trigger,
      status: "running",
      counts: emptyCounts(),
      source_status: [],
      ai_status: null,
      recipient_email: recipient,
      resend_email_id: null,
      email_status: null,
      started_at: new Date().toISOString(),
      finished_at: null,
      error_summary: null,
    };
    mem.runs.unshift(run);
    return { created: true, run };
  }
  async reclaimFailedRun(runKey: string, staleMs: number) {
    const staleBefore = new Date(Date.now() - staleMs).toISOString();
    const r = mem.runs.find(
      (x) => x.run_key === runKey && !x.resend_email_id && (x.status === "failed" || (x.status === "running" && x.started_at < staleBefore)),
    );
    if (!r) return null;
    r.status = "running";
    r.started_at = new Date().toISOString();
    r.finished_at = null;
    r.error_summary = null;
    return r;
  }
  async updateRun(id: string, patch: Partial<RunRecord>) {
    const r = mem.runs.find((x) => x.id === id);
    if (r) Object.assign(r, patch);
  }
  async listRuns(limit: number) {
    return mem.runs.slice(0, limit);
  }
  async lastRun(trigger: TriggerType) {
    return mem.runs.find((r) => r.trigger_type === trigger) ?? null;
  }
}

// ---------------------------------------------------------------------------
// Supabase store
// ---------------------------------------------------------------------------

type DbEventRow = Omit<EventRecord, "sources"> & {
  id: string;
  event_sources?: { source_name: string; source_url: string; discovered_at: string }[];
};

type DbRunRow = {
  id: string;
  run_key: string;
  trigger_type: TriggerType;
  status: RunRecord["status"];
  discovered_count: number;
  normalized_count: number;
  deduplicated_count: number;
  filtered_count: number;
  needs_verification_count: number;
  emailed_count: number;
  source_status: RunRecord["source_status"];
  ai_status: RunRecord["ai_status"];
  recipient_email: string | null;
  resend_email_id: string | null;
  email_status: RunRecord["email_status"];
  started_at: string;
  finished_at: string | null;
  error_summary: string | null;
};

function runFromRow(r: DbRunRow): RunRecord {
  return {
    id: r.id,
    run_key: r.run_key,
    trigger_type: r.trigger_type,
    status: r.status,
    counts: {
      discovered: r.discovered_count,
      normalized: r.normalized_count,
      deduplicated: r.deduplicated_count,
      actionable: r.filtered_count,
      needs_verification: r.needs_verification_count,
      emailed: r.emailed_count,
    },
    source_status: r.source_status ?? [],
    ai_status: r.ai_status,
    recipient_email: r.recipient_email,
    resend_email_id: r.resend_email_id,
    email_status: r.email_status,
    started_at: r.started_at,
    finished_at: r.finished_at,
    error_summary: r.error_summary,
  };
}

function runPatchToRow(p: Partial<RunRecord>): Partial<DbRunRow> {
  const row: Partial<DbRunRow> = {};
  if (p.status) row.status = p.status;
  if (p.counts) {
    row.discovered_count = p.counts.discovered;
    row.normalized_count = p.counts.normalized;
    row.deduplicated_count = p.counts.deduplicated;
    row.filtered_count = p.counts.actionable;
    row.needs_verification_count = p.counts.needs_verification;
    row.emailed_count = p.counts.emailed;
  }
  if (p.source_status) row.source_status = p.source_status;
  if (p.ai_status !== undefined) row.ai_status = p.ai_status;
  if (p.recipient_email !== undefined) row.recipient_email = p.recipient_email;
  if (p.resend_email_id !== undefined) row.resend_email_id = p.resend_email_id;
  if (p.email_status !== undefined) row.email_status = p.email_status;
  if (p.finished_at !== undefined) row.finished_at = p.finished_at;
  if (p.error_summary !== undefined) row.error_summary = p.error_summary;
  return row;
}

function registrationStatus(e: EventRecord, now: Date): string {
  if (e.event_status === "cancelled") return "cancelled";
  const d = deadlineStatus(e.registration_deadline, now).status;
  return d === "unknown" ? "deadline_unknown" : d;
}

class SupabaseStore implements Store {
  readonly kind = "supabase" as const;
  constructor(private db: SupabaseClient) {}

  async getPreferences(): Promise<Preferences> {
    const { data, error } = await this.db.from("user_preferences").select("*").order("created_at").limit(1).maybeSingle();
    if (error) throw new Error(`Supabase: could not load preferences (${error.message})`);
    if (!data) return defaultPreferences(env.defaultTimezone(), env.digestToEmail() ?? null);
    return data as Preferences;
  }

  async savePreferences(p: Preferences): Promise<Preferences> {
    const current = await this.db.from("user_preferences").select("id").order("created_at").limit(1).maybeSingle();
    const row = {
      email: p.email,
      domains: p.domains,
      cities: p.cities,
      categories: p.categories,
      allow_online_events: p.allow_online_events,
      timezone: p.timezone,
      max_digest_events: p.max_digest_events,
      min_relevance_score: p.min_relevance_score,
      rss_feeds: p.rss_feeds,
      extra_source_urls: p.extra_source_urls,
    };
    const q = current.data?.id
      ? this.db.from("user_preferences").update(row).eq("id", current.data.id).select("*").single()
      : this.db.from("user_preferences").insert(row).select("*").single();
    const { data, error } = await q;
    if (error) throw new Error(`Supabase: could not save preferences (${error.message})`);
    return data as Preferences;
  }

  async upsertEvents(events: EventRecord[], now: Date) {
    if (!events.length) return;
    const rows = events.map((e) => ({
      dedupe_key: e.dedupe_key,
      title: e.title,
      description: e.description,
      organizer: e.organizer,
      start_at: e.start_at,
      end_at: e.end_at,
      event_date: e.event_date,
      date_only: e.date_only,
      timezone: e.timezone,
      city: e.city,
      venue: e.venue,
      is_online: e.is_online,
      event_url: e.event_url,
      registration_url: e.registration_url,
      registration_deadline: e.registration_deadline,
      deadline_source: e.deadline_source,
      registration_status: registrationStatus(e, now),
      event_status: e.event_status,
      format: e.format,
      categories: e.categories,
      matched_domains: e.matched_domains,
      relevance_score: e.relevance_score,
      ai_summary: e.ai_summary,
      match_reason: e.match_reason,
      audience: e.audience,
      assessment_method: e.assessment_method,
      extraction_method: e.extraction_method,
      data_notes: e.data_notes,
      source_name: e.source_name,
      source_url: e.source_url,
      source_retrieved_at: e.source_retrieved_at,
      last_seen_at: now.toISOString(),
    }));
    const { data, error } = await this.db.from("events").upsert(rows, { onConflict: "dedupe_key" }).select("id, dedupe_key");
    if (error) throw new Error(`Supabase: could not save events (${error.message})`);
    const idByKey = new Map((data ?? []).map((r: { id: string; dedupe_key: string }) => [r.dedupe_key, r.id]));
    const sourceRows = events.flatMap((e) =>
      e.sources.map((s) => ({ event_id: idByKey.get(e.dedupe_key), source_name: s.source_name, source_url: s.source_url, discovered_at: s.discovered_at })),
    ).filter((r) => r.event_id);
    if (sourceRows.length) {
      const res = await this.db.from("event_sources").upsert(sourceRows, { onConflict: "event_id,source_url", ignoreDuplicates: true });
      if (res.error) throw new Error(`Supabase: could not save event sources (${res.error.message})`);
    }
  }

  async listRecentEvents(since: Date): Promise<EventRecord[]> {
    const { data, error } = await this.db
      .from("events")
      .select("*, event_sources(source_name, source_url, discovered_at)")
      .gte("last_seen_at", since.toISOString())
      .order("start_at", { ascending: true, nullsFirst: false })
      .limit(1000);
    if (error) throw new Error(`Supabase: could not load events (${error.message})`);
    return (data as DbEventRow[]).map(({ event_sources, ...row }) => ({
      ...row,
      start_at: row.start_at ? new Date(row.start_at).toISOString() : null,
      end_at: row.end_at ? new Date(row.end_at).toISOString() : null,
      registration_deadline: row.registration_deadline ? new Date(row.registration_deadline).toISOString() : null,
      sources: event_sources?.length
        ? event_sources
        : [{ source_name: row.source_name, source_url: row.source_url, discovered_at: row.source_retrieved_at }],
    }));
  }

  async createRun(runKey: string, trigger: TriggerType, recipient: string | null): Promise<CreateRunResult> {
    const { data, error } = await this.db
      .from("digest_runs")
      .insert({ run_key: runKey, trigger_type: trigger, status: "running", recipient_email: recipient })
      .select("*")
      .single();
    if (!error) return { created: true, run: runFromRow(data as DbRunRow) };
    if (error.code === "23505") {
      const existing = await this.db.from("digest_runs").select("*").eq("run_key", runKey).single();
      if (existing.error) throw new Error(`Supabase: could not read run (${existing.error.message})`);
      return { created: false, run: runFromRow(existing.data as DbRunRow) };
    }
    throw new Error(`Supabase: could not create run (${error.message})`);
  }

  async reclaimFailedRun(runKey: string, staleMs: number) {
    // Conditional update = atomic claim; concurrent retries cannot both succeed.
    const staleBefore = new Date(Date.now() - staleMs).toISOString();
    const { data, error } = await this.db
      .from("digest_runs")
      .update({ status: "running", started_at: new Date().toISOString(), finished_at: null, error_summary: null })
      .eq("run_key", runKey)
      .or(`status.eq.failed,and(status.eq.running,started_at.lt.${staleBefore})`)
      .is("resend_email_id", null)
      .select("*");
    if (error) throw new Error(`Supabase: could not reclaim run (${error.message})`);
    return data?.length ? runFromRow(data[0] as DbRunRow) : null;
  }

  async updateRun(id: string, patch: Partial<RunRecord>) {
    const { error } = await this.db.from("digest_runs").update(runPatchToRow(patch)).eq("id", id);
    if (error) throw new Error(`Supabase: could not update run (${error.message})`);
  }

  async listRuns(limit: number) {
    const { data, error } = await this.db.from("digest_runs").select("*").order("started_at", { ascending: false }).limit(limit);
    if (error) throw new Error(`Supabase: could not load runs (${error.message})`);
    return (data as DbRunRow[]).map(runFromRow);
  }

  async lastRun(trigger: TriggerType) {
    const { data, error } = await this.db
      .from("digest_runs")
      .select("*")
      .eq("trigger_type", trigger)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Supabase: could not load runs (${error.message})`);
    return data ? runFromRow(data as DbRunRow) : null;
  }
}

let cached: Store | null = null;

export function getStore(): Store {
  if (cached) return cached;
  const url = env.supabaseUrl();
  const key = env.supabaseServiceRoleKey();
  cached =
    url && key
      ? new SupabaseStore(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }))
      : new MemoryStore();
  return cached;
}

-- Industry Event Scout — initial schema
-- All access happens server-side with the service-role key. RLS is enabled on
-- every table with no anon/authenticated policies, so the public anon key can
-- neither read nor write anything.

create extension if not exists pgcrypto;

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  email text null,
  domains text[] not null default '{}',
  cities text[] not null default '{}',
  categories text[] not null default '{}',
  allow_online_events boolean not null default true,
  timezone text not null default 'Asia/Kolkata',
  max_digest_events integer not null default 10 check (max_digest_events between 1 and 50),
  min_relevance_score integer not null default 40 check (min_relevance_score between 0 and 100),
  rss_feeds text[] not null default '{}',
  extra_source_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  title text not null,
  description text null,
  organizer text null,
  start_at timestamptz null,
  end_at timestamptz null,
  event_date date null,
  date_only boolean not null default false,
  timezone text null,
  city text null,
  venue text null,
  is_online boolean null,
  event_url text not null,
  registration_url text null,
  registration_deadline timestamptz null,
  deadline_source text null,
  registration_status text not null default 'unknown'
    check (registration_status in ('open', 'urgent', 'deadline_unknown', 'closed', 'cancelled', 'unknown')),
  event_status text not null default 'unknown',
  format text null,
  categories text[] not null default '{}',
  matched_domains text[] not null default '{}',
  relevance_score integer null check (relevance_score between 0 and 100),
  ai_summary text null,
  match_reason text null,
  audience text null,
  assessment_method text null check (assessment_method in ('gemini', 'rules')),
  extraction_method text not null,
  data_notes text[] not null default '{}',
  source_name text not null,
  source_url text not null,
  source_retrieved_at timestamptz not null,
  raw_data jsonb null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_start_at_idx on public.events (start_at);
create index if not exists events_city_idx on public.events (city);
create index if not exists events_deadline_idx on public.events (registration_deadline);
create index if not exists events_score_idx on public.events (relevance_score desc);
create index if not exists events_last_seen_idx on public.events (last_seen_at desc);

create table if not exists public.event_sources (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  source_name text not null,
  source_url text not null,
  discovered_at timestamptz not null default now(),
  unique (event_id, source_url)
);

create table if not exists public.digest_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  trigger_type text not null check (trigger_type in ('cron', 'manual_refresh', 'test_email')),
  status text not null check (status in ('running', 'succeeded', 'partial_failure', 'failed', 'skipped')),
  discovered_count integer not null default 0,
  normalized_count integer not null default 0,
  deduplicated_count integer not null default 0,
  filtered_count integer not null default 0,
  needs_verification_count integer not null default 0,
  emailed_count integer not null default 0,
  source_status jsonb not null default '[]'::jsonb,
  ai_status jsonb null,
  recipient_email text null,
  resend_email_id text null,
  email_status text null check (email_status in ('not_attempted', 'sent', 'failed', 'skipped')),
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  error_summary text null
);

create index if not exists digest_runs_started_idx on public.digest_runs (started_at desc);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists user_preferences_touch on public.user_preferences;
create trigger user_preferences_touch before update on public.user_preferences
  for each row execute function public.touch_updated_at();

drop trigger if exists events_touch on public.events;
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

alter table public.user_preferences enable row level security;
alter table public.events enable row level security;
alter table public.event_sources enable row level security;
alter table public.digest_runs enable row level security;
-- Intentionally no policies: only the server (service role, which bypasses RLS) can access data.

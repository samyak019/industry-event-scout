import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getStore } from "@/lib/store";
import { loadCurrentEvents } from "@/lib/pipeline";
import { isAdmin } from "@/lib/auth";
import { configStatus } from "@/lib/env";
import { windowBounds, WINDOW_DAYS } from "@/lib/processing/filter";
import { matchTargetCity } from "@/lib/processing/cities";
import { DAY_MS, formatEventDate } from "@/lib/time";
import type { Bucket, ClassifiedEvent, Preferences, RunRecord } from "@/lib/types";
import { EventCard } from "@/components/event-card";
import { EventFilters } from "@/components/event-filters";
import { SourceStatus } from "@/components/source-status";
import { ActionButton } from "@/components/action-button";

type SP = Promise<Record<string, string | string[] | undefined>>;

const VIEWS: { key: string; bucket: Bucket; label: string }[] = [
  { key: "", bucket: "actionable", label: "Actionable" },
  { key: "verify", bucket: "needs_verification", label: "Needs verification" },
  { key: "closed", bucket: "closed", label: "Closed" },
  { key: "excluded", bucket: "excluded", label: "Filtered out" },
];

function applyFilters(events: ClassifiedEvent[], f: Record<string, string>) {
  return events.filter((e) => {
    if (f.city === "online" && e.is_online !== true) return false;
    if (f.city && f.city !== "online" && matchTargetCity({ city: e.city, venue: e.venue }, [f.city]) === null) return false;
    if (f.domain && !e.matched_domains.includes(f.domain)) return false;
    if (f.urgency && e.deadline.status !== f.urgency) return false;
    if (f.source && !e.sources.some((s) => s.source_name === f.source)) return false;
    return true;
  });
}

/* ------------------------------------------------------------------ hero */

function Hero({ actionable, prefs, admin, now }: { actionable: ClassifiedEvent[]; prefs: Preferences; admin: boolean; now: Date }) {
  const tz = prefs.timezone;
  const { end } = windowBounds(now);
  const fmt = new Intl.DateTimeFormat("en-IN", { timeZone: tz, day: "numeric", month: "short" });
  const top = actionable.slice(0, 2);
  return (
    <section className="grid items-center gap-10 px-5 pb-12 pt-6 sm:px-8 lg:grid-cols-12 lg:pt-12">
      <div className="lg:col-span-7">
        <p className="mono-tag flex items-center gap-2 text-lime">
          <span className="pulse-dot" aria-hidden /> AI-ranked · Gemini Flash · {fmt.format(now)} → {fmt.format(end)}
        </p>
        <h1 className="display mt-6 text-[3.25rem] font-semibold leading-[0.85] text-white sm:text-7xl xl:text-[7.5rem]">
          Events worth <em className="text-gradient-lime pr-2 font-light">attending.</em>
        </h1>
        <p className="mt-8 max-w-xl text-lg leading-relaxed text-white/60">
          Conferences, CXO summits, roundtables and founder meetups from live sources — ranked against your focus areas, with closing registration deadlines flagged before it&apos;s too late.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          {admin ? (
            <ActionButton endpoint="/api/events/refresh" label="Refresh events" busyLabel="Scouting…" />
          ) : (
            <Link href="/login" className="btn-neon px-7 py-3.5 text-base">
              Sign in to refresh
            </Link>
          )}
          <Link href="/digest" className="rounded-full border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:border-lime/50">
            Preview digest
          </Link>
        </div>
      </div>

      <div className="relative lg:col-span-5">
        <div className="glass relative overflow-hidden rounded-[2.5rem] p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="h-2.5 w-2.5 rounded-full bg-lime/80" />
            </div>
            <span className="mono-tag text-white/40">top_matches.live</span>
          </div>
          <div className="mt-6 space-y-4">
            {top.length ? (
              top.map((e, i) => (
                <div key={e.dedupe_key} className={`glass rounded-[1.5rem] p-4 ${i === 0 ? "float-anim" : "float-anim-delay ml-6"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="mono-tag text-white/40">{formatEventDate(e, tz)}</p>
                      <p className="display mt-1 line-clamp-2 text-lg font-semibold leading-tight text-white">{e.title}</p>
                      <p className="mt-1 text-xs text-white/50">{e.is_online ? "Online" : e.city ?? "Location not listed"}</p>
                    </div>
                    <span className={`display text-3xl font-semibold ${i === 0 ? "text-lime" : "text-white"}`}>{e.relevance_score ?? "—"}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="glass rounded-[1.5rem] p-6 text-sm text-white/60">No matching events yet — run a live refresh to scout the sources.</div>
            )}
          </div>
          {top[0]?.match_reason ? (
            <div className="float-anim-delay absolute bottom-5 right-5 max-w-[70%] rounded-2xl rounded-tr-sm bg-lime px-3 py-2 text-xs font-medium text-black shadow-[0_0_30px_rgba(204,255,0,0.3)]">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em]">▲ AI cursor</span>
              <p className="line-clamp-2">{top[0].match_reason}</p>
            </div>
          ) : null}
          <div className="h-16" aria-hidden />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ bento */

function Bento({ all, actionable, prefs, lastRun, now }: { all: ClassifiedEvent[]; actionable: ClassifiedEvent[]; prefs: Preferences; lastRun: RunRecord | null; now: Date }) {
  const weeks = [0, 1, 2, 3, 4].map((w) => ({
    label: w === 4 ? `D${w * 7 + 1}–${WINDOW_DAYS}` : `W${w + 1}`,
    count: actionable.filter((e) => {
      if (!e.start_at) return false;
      const idx = Math.floor((Date.parse(e.start_at) - now.getTime()) / (7 * DAY_MS));
      return Math.min(Math.max(idx, 0), 4) === w;
    }).length,
  }));
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const urgent = actionable.filter((e) => e.deadline.status === "urgent");
  const swatches = ["bg-lime", "bg-emerald-glow", "bg-white", "bg-white/40", "bg-white/20"];
  const card = "glass relative overflow-hidden rounded-[2.5rem] p-6 transition-colors duration-300 hover:border-lime/40";

  return (
    <section className="grid gap-4 px-5 sm:grid-cols-2 sm:px-8 lg:auto-rows-[200px] lg:grid-cols-4" aria-label="Overview">
      <div className={`${card} sm:col-span-2 lg:row-span-2`}>
        <p className="mono-tag text-white/40">Actionable events · next {WINDOW_DAYS} days</p>
        <p className="display mt-2 text-6xl font-semibold text-white">{actionable.length}</p>
        <div className="mt-6 flex h-[170px] items-end gap-3 sm:gap-5" role="img" aria-label={`Events per week: ${weeks.map((w) => `${w.label} ${w.count}`).join(", ")}`}>
          {weeks.map((w, i) => (
            <div key={w.label} className="flex flex-1 flex-col items-center gap-2">
              <span className="font-mono text-xs text-white/60">{w.count}</span>
              <div
                className={`w-full rounded-t-2xl ${i === 0 ? "bg-lime shadow-[0_0_30px_rgba(204,255,0,0.3)]" : "bg-white/15"}`}
                style={{ height: `${Math.max(6, (w.count / max) * 120)}px` }}
              />
              <span className="mono-tag text-white/40">{w.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={`${card} lg:row-span-2`}>
        <p className="mono-tag text-white/40">Focus domains</p>
        <ul className="mt-5 space-y-3">
          {prefs.domains.map((d, i) => {
            const n = actionable.filter((e) => e.matched_domains.includes(d)).length;
            return (
              <li key={d} className="flex items-center gap-3">
                <span className={`h-10 w-10 shrink-0 rounded-xl ${swatches[i % swatches.length]}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{d}</p>
                  <p className="font-mono text-[11px] text-white/40">{n} matched</p>
                </div>
              </li>
            );
          })}
        </ul>
        <Link href="/settings" className="mono-tag absolute bottom-6 left-6 text-lime hover:underline">Edit focus →</Link>
      </div>

      <div className="noise relative overflow-hidden rounded-[2.5rem] bg-lime p-6 text-black">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]">Deadlines &lt; 7 days</p>
        <p className="display mt-2 text-6xl font-bold">{urgent.length}</p>
        <Link href="/?urgency=urgent" className="absolute bottom-6 left-6 text-sm font-semibold underline-offset-4 hover:underline">
          {urgent.length ? "Act on these →" : "Nothing closing this week"}
        </Link>
      </div>

      <div className={card}>
        <p className="mono-tag text-white/40">Pipeline · last run</p>
        <dl className="mt-4 grid grid-cols-2 gap-y-2 font-mono text-sm">
          <dt className="text-white/40">Found</dt>
          <dd className="text-right text-white">{lastRun?.counts.discovered ?? "—"}</dd>
          <dt className="text-white/40">Unique</dt>
          <dd className="text-right text-white">{all.length}</dd>
          <dt className="text-white/40">To verify</dt>
          <dd className="text-right text-white">{all.filter((e) => e.bucket === "needs_verification").length}</dd>
        </dl>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ methodology */

function Methodology() {
  const steps = [
    { n: "01", t: "Discover", d: "Tavily search, Luma and AllEvents.in city pages, RSS feeds and your organiser pages are queried in parallel. Every event keeps its source link." },
    { n: "02", t: "Interpret", d: "Gemini Flash classifies each event against your domains, scores relevance 0–100 and explains why — labelled as AI judgement, never as fact." },
    { n: "03", t: "Enforce & deliver", d: "Code enforces the 30-day window, target cities and the < 7-day deadline rule, then the Monday digest goes out via Resend." },
  ];
  return (
    <section className="mt-20 rounded-t-[4rem] bg-contrast px-5 py-16 text-black sm:px-12 sm:py-20">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-black/50">Methodology</p>
          <h2 className="display mt-3 text-4xl font-semibold leading-[0.95] sm:text-6xl">
            AI interprets.
            <br />
            Code enforces.
          </h2>
          <ol className="mt-10 space-y-6">
            {steps.map((s) => (
              <li key={s.n} className="flex gap-5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-black/20 font-mono text-sm">{s.n}</span>
                <div>
                  <p className="text-lg font-semibold">{s.t}</p>
                  <p className="mt-1 max-w-md text-sm leading-relaxed text-black/60">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-md">
          <div
            className="absolute inset-0 rounded-full grayscale"
            style={{ background: "conic-gradient(from 210deg, #111 0deg, #777 90deg, #ddd 160deg, #222 260deg, #111 360deg)" }}
            aria-hidden
          />
          <div className="bg-grid absolute inset-0 rounded-full opacity-60" aria-hidden />
          <div className="absolute inset-x-4 bottom-4 rounded-[1.5rem] border border-white/20 bg-white/10 p-5 text-white backdrop-blur-[16px] sm:inset-x-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime">Design principle</p>
            <p className="mt-2 text-lg leading-snug">Source data grounds every date, deadline and link. If a source doesn&apos;t say it, the scout doesn&apos;t either.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ page */

async function Dashboard({ searchParams }: { searchParams: SP }) {
  await connection();
  const sp = await searchParams;
  const f: Record<string, string> = {};
  for (const k of ["city", "domain", "urgency", "source", "view"]) {
    const v = sp[k];
    if (typeof v === "string" && v) f[k] = v;
  }
  const store = getStore();
  const cfg = configStatus();
  const now = new Date();

  let loadError: string | null = null;
  let prefs: Preferences;
  let all: ClassifiedEvent[] = [];
  let runs: RunRecord[] = [];
  try {
    prefs = await store.getPreferences();
    [all, runs] = await Promise.all([loadCurrentEvents(prefs, now), store.listRuns(10)]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not load data";
    prefs = (await import("@/lib/store/defaults")).defaultPreferences();
  }
  const admin = await isAdmin();
  const tz = prefs.timezone;
  const actionable = all.filter((e) => e.bucket === "actionable");
  const view = VIEWS.find((v) => v.key === (f.view ?? "")) ?? VIEWS[0];
  const inView = all.filter((e) => e.bucket === view.bucket);
  const shown = applyFilters(inView, f);
  const lastDiscovery = runs.find((r) => r.trigger_type !== "test_email") ?? null;
  const sources = [...new Set(all.flatMap((e) => e.sources.map((s) => s.source_name)))].sort();

  const notices = [
    loadError ? { tone: "error", text: loadError } : null,
    store.kind === "memory" ? { tone: "warn", text: "Supabase is not configured — results live in server memory only and are not persisted." } : null,
    !cfg.gemini ? { tone: "warn", text: "GEMINI_API_KEY is not set — relevance uses a labelled rules-based fallback and no AI summaries are generated." } : null,
  ].filter((n): n is { tone: string; text: string } => n !== null);

  return (
    <>
      <Hero actionable={actionable} prefs={prefs} admin={admin} now={now} />

      {notices.length ? (
        <div className="space-y-2 px-5 pb-6 sm:px-8">
          {notices.map((n) => (
            <p key={n.text} role={n.tone === "error" ? "alert" : undefined} className={`glass rounded-2xl px-4 py-3 text-sm ${n.tone === "error" ? "text-red-300" : "text-amber-200/90"}`}>
              {n.text}
            </p>
          ))}
        </div>
      ) : null}

      <Bento all={all} actionable={actionable} prefs={prefs} lastRun={lastDiscovery} now={now} />

      <section id="events" className="mt-16 grid gap-6 px-5 sm:px-8 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="display text-3xl font-semibold text-white sm:text-4xl">Ranked events</h2>
            <nav className="flex flex-wrap gap-1 rounded-full bg-white/5 p-1 ring-1 ring-white/10" aria-label="Event lists">
              {VIEWS.map((v) => {
                const n = all.filter((e) => e.bucket === v.bucket).length;
                const active = v.key === view.key;
                return (
                  <Link
                    key={v.key}
                    href={v.key ? `/?view=${v.key}#events` : "/#events"}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-full px-3 py-1.5 text-sm transition-colors ${active ? "bg-lime font-semibold text-black" : "text-white/60 hover:text-white"}`}
                  >
                    {v.label} <span className="font-mono text-[11px] opacity-60">{n}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          <EventFilters current={f} cities={prefs.cities} domains={prefs.domains} sources={sources} />
          <p className="mono-tag text-white/40">
            Showing {shown.length} of {inView.length} · {view.label}
            {view.bucket === "needs_verification" ? " · date or location not established — check source" : ""}
            {view.bucket === "excluded" ? " · removed by code rules" : ""}
          </p>
          {shown.length ? (
            <div className="space-y-4">
              {shown.map((e, i) => (
                <EventCard key={e.dedupe_key} e={e} rank={view.bucket === "actionable" ? i + 1 : undefined} timeZone={tz} />
              ))}
            </div>
          ) : (
            <div className="glass rounded-[2rem] p-10 text-center text-white/60">
              {all.length === 0
                ? "No events stored yet. Run a live refresh to query the configured sources."
                : "No events match these filters. Nothing is padded or invented — try another view or broaden your preferences."}
            </div>
          )}
        </div>
        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <section className="glass rounded-[2rem] p-6">
            <h2 className="mono-tag mb-4 text-white/50">Sources queried</h2>
            <SourceStatus run={lastDiscovery} timeZone={tz} />
          </section>
          <section className="glass rounded-[2rem] p-6 text-sm">
            <h2 className="mono-tag mb-4 text-white/50">Your filters</h2>
            <dl className="space-y-2 text-white/70">
              <div><dt className="mono-tag inline text-white/40">Cities </dt><dd className="inline">{prefs.cities.join(", ") || "—"}{prefs.allow_online_events ? " + online" : ""}</dd></div>
              <div><dt className="mono-tag inline text-white/40">Formats </dt><dd className="inline">{prefs.categories.join(", ") || "Any"}</dd></div>
              <div><dt className="mono-tag inline text-white/40">Min score </dt><dd className="inline">{prefs.min_relevance_score}</dd></div>
            </dl>
          </section>
        </aside>
      </section>

      <Methodology />
    </>
  );
}

export default function Page({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<p className="mono-tag px-8 py-20 text-white/50">Loading events…</p>}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

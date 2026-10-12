"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Preferences } from "@/lib/types";

type SaveState = { ok: boolean; message: string; errors?: Record<string, string> };

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="mono-tag text-white/50">{label}</span>
      {children}
      {hint ? <span className="text-xs text-white/40">{hint}</span> : null}
      {error ? <span className="text-xs font-medium text-red-400">{error}</span> : null}
    </div>
  );
}

const input = "field px-4 py-3 text-sm";

export function PreferenceForm({ prefs, editable }: { prefs: Preferences; editable: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<SaveState>({ ok: true, message: "" });
  const [pending, setPending] = useState(false);
  const e = state.errors ?? {};

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setPending(true);
    try {
      const res = await fetch("/api/preferences", { method: "POST", body: new FormData(ev.currentTarget) });
      setState((await res.json()) as SaveState);
      if (res.ok) router.refresh();
    } catch {
      setState({ ok: false, message: "Network error — preferences not saved" });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <fieldset disabled={!editable || pending} className="grid gap-5 sm:grid-cols-2">
        <label className="contents">
          <Field label="Professional domains / focus areas" hint="One per line. Gemini may only match events to these exact labels." error={e.domains}>
            <textarea name="domains" rows={5} defaultValue={prefs.domains.join("\n")} className={input} />
          </Field>
        </label>
        <label className="contents">
          <Field label="Event categories / formats" hint="One per line, e.g. Conferences, CXO summits, Roundtables." error={e.categories}>
            <textarea name="categories" rows={5} defaultValue={prefs.categories.join("\n")} className={input} />
          </Field>
        </label>
        <label className="contents">
          <Field label="Target cities" hint="One per line. Aliases handled (Bangalore = Bengaluru; Delhi NCR includes Gurugram, Noida…)." error={e.cities}>
            <textarea name="cities" rows={4} defaultValue={prefs.cities.join("\n")} className={input} />
          </Field>
        </label>
        <div className="flex flex-col gap-4">
          <label className="contents">
            <Field label="Digest recipient email" error={e.email}>
              <input type="email" name="email" defaultValue={prefs.email ?? ""} className={input} placeholder="you@example.com" />
            </Field>
          </label>
          <label className="contents">
            <Field label="Time zone (IANA)" error={e.timezone}>
              <input name="timezone" defaultValue={prefs.timezone} className={input} />
            </Field>
          </label>
          <label className="flex items-center gap-3 text-sm text-white/80">
            <input type="checkbox" name="allow_online_events" defaultChecked={prefs.allow_online_events} className="h-4 w-4 accent-[#ccff00]" />
            Include online events
          </label>
        </div>
        <label className="contents">
          <Field label="Maximum events in digest" hint="Urgent deadlines may add up to 5 extra events." error={e.max_digest_events}>
            <input type="number" name="max_digest_events" min={1} max={50} defaultValue={String(prefs.max_digest_events)} className={input} />
          </Field>
        </label>
        <label className="contents">
          <Field label="Minimum relevance score (0–100)" error={e.min_relevance_score}>
            <input type="number" name="min_relevance_score" min={0} max={100} defaultValue={String(prefs.min_relevance_score)} className={input} />
          </Field>
        </label>
        <label className="contents">
          <Field label="RSS/Atom feeds" hint="One URL per line. Use {city} to repeat a feed for each target city." error={e.rss_feeds}>
            <textarea name="rss_feeds" rows={3} defaultValue={prefs.rss_feeds.join("\n")} className={`${input} font-mono text-xs`} />
          </Field>
        </label>
        <label className="contents">
          <Field label="Extra public event pages" hint="Organiser or listing pages to check each run (schema.org data used when present)." error={e.extra_source_urls}>
            <textarea name="extra_source_urls" rows={3} defaultValue={prefs.extra_source_urls.join("\n")} className={`${input} font-mono text-xs`} />
          </Field>
        </label>
      </fieldset>
      <div className="flex items-center gap-3">
        <button disabled={!editable || pending} className="btn-neon px-7 py-3 text-sm disabled:cursor-not-allowed">
          {pending ? "Saving…" : "Save preferences"}
        </button>
        {state.message ? (
          <span role="status" className={`text-sm ${state.ok ? "text-lime" : "text-red-400"}`}>
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}

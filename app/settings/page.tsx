import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getStore } from "@/lib/store";
import { isAdmin } from "@/lib/auth";
import { configStatus } from "@/lib/env";
import { PreferenceForm } from "@/components/preference-form";
import { StatusChip } from "@/components/source-status";

async function Settings() {
  await connection();
  const [prefs, admin] = await Promise.all([getStore().getPreferences(), isAdmin()]);
  const cfg = configStatus();
  const integrations: [string, boolean, string][] = [
    ["Supabase", cfg.supabase, "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"],
    [`Gemini · ${cfg.geminiModel}`, cfg.gemini, "GEMINI_API_KEY"],
    ["Tavily search", cfg.tavily, "TAVILY_API_KEY"],
    ["Resend email", cfg.resend, "RESEND_API_KEY, RESEND_FROM_EMAIL"],
    ["Cron secret", cfg.cronSecret, "CRON_SECRET"],
    ["Admin password", cfg.adminPassword, "ADMIN_PASSWORD"],
    ["Eventbrite (optional)", cfg.eventbrite, "EVENTBRITE_API_TOKEN, EVENTBRITE_ORGANIZER_IDS"],
  ];
  return (
    <div className="px-5 pb-20 pt-6 sm:px-8">
      <p className="mono-tag text-lime">Configuration</p>
      <h1 className="display mt-3 text-5xl font-semibold leading-[0.9] text-white sm:text-7xl">Preferences</h1>
      <p className="mt-4 max-w-2xl text-white/60">These drive search queries, filtering, Gemini relevance scoring and the Monday digest. Defaults are illustrative examples only.</p>
      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="glass rounded-[2.5rem] p-6 sm:p-8">
          {!admin ? (
            <p className="mb-6 rounded-2xl border border-lime/30 bg-lime/5 p-4 text-sm text-white/80">
              Read-only. <Link href="/login?next=/settings" className="font-semibold text-lime underline-offset-4 hover:underline">Sign in as admin</Link> to edit.
            </p>
          ) : null}
          <PreferenceForm prefs={prefs} editable={admin} />
        </section>
        <aside className="glass h-fit rounded-[2.5rem] p-6">
          <h2 className="mono-tag mb-4 text-white/50">Integrations</h2>
          <ul className="space-y-3 text-sm">
            {integrations.map(([name, ok, vars]) => (
              <li key={name}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white/90">{name}</span>
                  <StatusChip status={ok ? "ok" : "not_configured"} />
                </div>
                {!ok ? <div className="font-mono text-[11px] text-white/30">{vars}</div> : null}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs text-white/40">Public sources (Luma, AllEvents.in, RSS) need no key.</p>
        </aside>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="mono-tag px-8 py-20 text-white/50">Loading settings…</p>}>
      <Settings />
    </Suspense>
  );
}

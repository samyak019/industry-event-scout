import { Suspense } from "react";
import { connection } from "next/server";
import { getStore } from "@/lib/store";
import { loadCurrentEvents } from "@/lib/pipeline";
import { buildDigest } from "@/lib/email/render-digest";
import { isAdmin } from "@/lib/auth";
import { env, configStatus } from "@/lib/env";
import { ActionButton } from "@/components/action-button";
import { StatusChip, runChipStatus } from "@/components/source-status";
import { PanelSkeleton } from "@/components/skeletons";

async function Digest() {
  await connection();
  const store = getStore();
  const now = new Date();
  const prefs = await store.getPreferences();
  const [events, runs, admin] = await Promise.all([loadCurrentEvents(prefs, now), store.listRuns(15), isAdmin()]);
  // Same events + same renderer as the scheduled email.
  const digest = buildDigest(events, prefs, now, env.appUrl());
  const cfg = configStatus();
  const recipient = prefs.email ?? env.digestToEmail() ?? null;
  const tz = prefs.timezone;

  return (
    <div className="space-y-8 px-5 pb-20 pt-6 sm:px-8">
      <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mono-tag flex items-center gap-2 text-lime">
            <span className="pulse-dot" aria-hidden /> Mondays · 02:30 UTC ≈ 08:00 IST
          </p>
          <h1 className="display mt-3 text-5xl font-semibold leading-[0.9] text-white sm:text-7xl">
            Weekly <em className="text-gradient-lime font-light">digest.</em>
          </h1>
          <p className="mt-4 max-w-2xl text-white/60">
            Exact preview of the email — same events and renderer as the scheduled send. Vercel Hobby crons fire within the scheduled hour. Recipient: <span className="font-mono text-white/80">{recipient ?? "not set"}</span>
          </p>
        </div>
        {admin ? (
          cfg.resend ? (
            <ActionButton endpoint="/api/digest/test" label="Send test email" busyLabel="Sending…" />
          ) : (
            <span className="text-sm text-amber-200/80">Resend not configured — test email disabled.</span>
          )
        ) : (
          <span className="mono-tag text-white/40">Sign in to send a test email</span>
        )}
      </section>

      <section className="glass overflow-hidden rounded-[2.5rem]">
        <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-6 py-4">
          <div className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-lime/80" />
          </div>
          <span className="mono-tag text-white/40">Subject</span>
          <span className="text-sm text-white/90">{digest.subject}</span>
        </div>
        <iframe
          title="Digest email preview"
          srcDoc={digest.html.replace("<head>", "<head><base target=\"_blank\">")}
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          className="h-[760px] w-full bg-[#f2f4f7]"
        />
      </section>

      <section className="glass rounded-[2.5rem] p-6 sm:p-8">
        <h2 className="display mb-5 text-3xl font-semibold text-white">Run history</h2>
        {runs.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="mono-tag text-white/40">
                  <th className="pb-3 pr-4 font-normal">Started</th>
                  <th className="pb-3 pr-4 font-normal">Trigger</th>
                  <th className="pb-3 pr-4 font-normal">Status</th>
                  <th className="pb-3 pr-4 font-normal">Found → unique → actionable</th>
                  <th className="pb-3 pr-4 font-normal">Email</th>
                  <th className="pb-3 font-normal">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/80">
                {runs.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="whitespace-nowrap py-3 pr-4 font-mono text-xs">{new Date(r.started_at).toLocaleString("en-IN", { timeZone: tz, dateStyle: "medium", timeStyle: "short" })}</td>
                    <td className="py-3 pr-4">{r.trigger_type.replace("_", " ")}</td>
                    <td className="py-3 pr-4"><StatusChip status={runChipStatus(r.status)} /></td>
                    <td className="py-3 pr-4 font-mono text-xs">{r.counts.discovered} → {r.counts.deduplicated} → {r.counts.actionable}</td>
                    <td className="py-3 pr-4">
                      {r.email_status ?? "—"}
                      {r.resend_email_id ? <div className="font-mono text-[10px] text-white/40">{r.resend_email_id}</div> : null}
                    </td>
                    <td className="max-w-xs py-3 text-xs text-white/40">{r.error_summary ? r.error_summary.slice(0, 220) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-white/60">No runs recorded yet.</p>
        )}
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="space-y-8 px-5 pb-20 pt-6 sm:px-8">
          <div>
            <p className="mono-tag flex items-center gap-2 text-lime">
              <span className="pulse-dot" aria-hidden /> Mondays · 02:30 UTC ≈ 08:00 IST
            </p>
            <h1 className="display mt-3 text-5xl font-semibold leading-[0.9] text-white sm:text-7xl">
              Weekly <em className="text-gradient-lime font-light">digest.</em>
            </h1>
            <p className="mono-tag mt-4 text-white/40">Rendering preview…</p>
          </div>
          <PanelSkeleton tall />
        </div>
      }
    >
      <Digest />
    </Suspense>
  );
}

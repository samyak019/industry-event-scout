import "server-only";
import { env } from "./env";
import { getStore } from "./store";
import { loadCurrentEvents, runPipeline, type PipelineResult } from "./pipeline";
import { buildDigest } from "./email/render-digest";
import { sendEmail } from "./email/resend";
import type { RunRecord } from "./types";
import { localDate, DAY_MS } from "./time";

const STALE_RUN_MS = 15 * 60 * 1000;

function overallStatus(result: PipelineResult, emailOk: boolean | null): RunRecord["status"] {
  if (emailOk === false) return "failed";
  const sourceErrors = result.sourceStatus.some((s) => s.status === "error");
  const aiDegraded = ["partial", "unavailable"].includes(result.aiStatus.status);
  return sourceErrors || aiDegraded || !result.persisted ? "partial_failure" : "succeeded";
}

function errorSummary(result: PipelineResult, extra?: string | null): string | null {
  const parts = [
    ...result.sourceStatus.filter((s) => s.status === "error").map((s) => `${s.source}: ${s.message}`),
    result.aiStatus.status === "unavailable" || result.aiStatus.status === "partial" ? `AI: ${result.aiStatus.message}` : null,
    ...result.warnings,
    extra ?? null,
  ].filter(Boolean);
  return parts.length ? parts.join(" | ").slice(0, 2000) : null;
}

/** Monday date (YYYY-MM-DD) of the week containing `now`, in the user's time zone. */
export function weekKey(now: Date, timeZone: string): string {
  const today = localDate(now, timeZone);
  const [y, m, d] = today.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun
  const back = (dow + 6) % 7;
  return localDate(new Date(Date.UTC(y, m - 1, d) - back * DAY_MS + 12 * 3600 * 1000), "UTC");
}

export type JobOutcome = {
  status: RunRecord["status"];
  runId?: string;
  message: string;
  counts?: PipelineResult["counts"];
  sourceStatus?: PipelineResult["sourceStatus"];
  aiStatus?: PipelineResult["aiStatus"];
  emailId?: string | null;
};

/** Scheduled Monday workflow. Idempotent per (week, preferences): at most one digest per week. */
export async function runWeeklyDigest(now = new Date(), deadlineMs?: number): Promise<JobOutcome> {
  const store = getStore();
  const prefs = await store.getPreferences();
  const recipient = prefs.email ?? env.digestToEmail() ?? null;
  const runKey = `cron:${weekKey(now, prefs.timezone)}:${prefs.id ?? "default"}`;

  const created = await store.createRun(runKey, "cron", recipient);
  let run = created.run;
  if (!created.created) {
    const stale = run.status === "running" && Date.now() - Date.parse(run.started_at) > STALE_RUN_MS;
    if (run.status !== "failed" && !stale) {
      return { status: "skipped", runId: run.id, message: `Digest for ${runKey} already ${run.status}; not sending again` };
    }
    const reclaimed = await store.reclaimFailedRun(runKey, STALE_RUN_MS);
    if (!reclaimed) return { status: "skipped", runId: run.id, message: "Another attempt is already handling this run" };
    run = reclaimed;
  }

  try {
    const result = await runPipeline({ prefs, now, deadlineMs });
    // The email uses the same read path as the dashboard/preview.
    const events = result.persisted ? await loadCurrentEvents(prefs, now) : result.events;
    const digest = buildDigest(events, prefs, now, env.appUrl());

    let emailStatus: RunRecord["email_status"] = "skipped";
    let emailId: string | null = null;
    let emailError: string | null = null;
    let emailOk: boolean | null = null;
    if (!recipient) {
      emailError = "No recipient configured (Settings email or DIGEST_TO_EMAIL)";
    } else {
      const sent = await sendEmail({ to: recipient, subject: digest.subject, html: digest.html, text: digest.text, idempotencyKey: runKey });
      if (sent.ok) {
        emailStatus = "sent";
        emailId = sent.id;
        emailOk = true;
      } else {
        emailStatus = sent.notConfigured ? "skipped" : "failed";
        emailOk = sent.notConfigured ? null : false;
        emailError = `Email: ${sent.error}`;
      }
    }

    // The scheduled job exists to deliver the digest: if nothing was delivered the run is
    // "failed", which also leaves it re-claimable by a retry later the same week.
    const status = emailStatus === "sent" ? overallStatus(result, emailOk) : "failed";
    await store.updateRun(run.id, {
      status,
      counts: { ...result.counts, emailed: emailStatus === "sent" ? digest.events.length : 0 },
      source_status: result.sourceStatus,
      ai_status: result.aiStatus,
      resend_email_id: emailId,
      email_status: emailStatus,
      finished_at: new Date().toISOString(),
      error_summary: errorSummary(result, emailError),
    });
    return {
      status,
      runId: run.id,
      message: emailStatus === "sent" ? `Digest sent to ${recipient} (Resend id ${emailId})` : emailError ?? "Digest not sent",
      counts: result.counts,
      sourceStatus: result.sourceStatus,
      aiStatus: result.aiStatus,
      emailId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await store.updateRun(run.id, { status: "failed", finished_at: new Date().toISOString(), error_summary: message.slice(0, 2000), email_status: "not_attempted" }).catch(() => {});
    return { status: "failed", runId: run.id, message };
  }
}

/** Manual "Refresh events": same pipeline, no email. */
export async function runManualRefresh(now = new Date(), deadlineMs?: number): Promise<JobOutcome> {
  const store = getStore();
  const last = await store.lastRun("manual_refresh");
  if (last && last.status === "running" && Date.now() - Date.parse(last.started_at) < 5 * 60 * 1000) {
    return { status: "skipped", runId: last.id, message: "A refresh is already running — try again in a few minutes" };
  }
  if (last && Date.now() - Date.parse(last.started_at) < 60 * 1000) {
    return { status: "skipped", runId: last.id, message: "Refreshed less than a minute ago — please wait before refreshing again" };
  }
  const prefs = await store.getPreferences();
  const { run } = await store.createRun(`manual:${now.toISOString()}`, "manual_refresh", null);
  try {
    const result = await runPipeline({ prefs, now, deadlineMs });
    const status = overallStatus(result, null);
    await store.updateRun(run.id, {
      status,
      counts: result.counts,
      source_status: result.sourceStatus,
      ai_status: result.aiStatus,
      email_status: "not_attempted",
      finished_at: new Date().toISOString(),
      error_summary: errorSummary(result),
    });
    return {
      status,
      runId: run.id,
      message: `${result.counts.actionable} actionable event(s), ${result.counts.needs_verification} needing verification${result.persisted ? "" : " (not persisted)"}`,
      counts: result.counts,
      sourceStatus: result.sourceStatus,
      aiStatus: result.aiStatus,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await store.updateRun(run.id, { status: "failed", finished_at: new Date().toISOString(), error_summary: message.slice(0, 2000) }).catch(() => {});
    return { status: "failed", runId: run.id, message };
  }
}

/** Protected test email: renders stored events with the production renderer; separate from the cron run. */
export async function sendTestDigest(now = new Date()): Promise<JobOutcome> {
  const store = getStore();
  const prefs = await store.getPreferences();
  const recipient = prefs.email ?? env.digestToEmail() ?? null;
  const { run } = await store.createRun(`test:${now.toISOString()}`, "test_email", recipient);
  if (!recipient) {
    await store.updateRun(run.id, { status: "failed", email_status: "skipped", finished_at: new Date().toISOString(), error_summary: "No recipient configured" });
    return { status: "failed", runId: run.id, message: "No recipient configured (Settings email or DIGEST_TO_EMAIL)" };
  }
  const events = await loadCurrentEvents(prefs, now);
  const digest = buildDigest(events, prefs, now, env.appUrl());
  const sent = await sendEmail({ to: recipient, subject: `[TEST] ${digest.subject}`, html: digest.html, text: digest.text });
  await store.updateRun(run.id, {
    status: sent.ok ? "succeeded" : "failed",
    counts: {
      discovered: 0,
      normalized: 0,
      deduplicated: events.length,
      actionable: events.filter((e) => e.bucket === "actionable").length,
      needs_verification: events.filter((e) => e.bucket === "needs_verification").length,
      emailed: sent.ok ? digest.events.length : 0,
    },
    resend_email_id: sent.ok ? sent.id : null,
    email_status: sent.ok ? "sent" : sent.notConfigured ? "skipped" : "failed",
    finished_at: new Date().toISOString(),
    error_summary: sent.ok ? null : sent.error,
  });
  return sent.ok
    ? { status: "succeeded", runId: run.id, message: `Test digest sent to ${recipient} (Resend id ${sent.id})`, emailId: sent.id }
    : { status: "failed", runId: run.id, message: `Test email not sent: ${sent.error}` };
}

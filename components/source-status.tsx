import type { AiStatus, RunRecord } from "@/lib/types";

const tone: Record<string, string> = {
  ok: "text-lime",
  partial: "text-amber-300",
  error: "text-red-400",
  disabled: "text-white/30",
  unavailable: "text-red-400",
  not_configured: "text-white/30",
  skipped: "text-white/40",
  running: "text-white/60",
};

export function StatusChip({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] ${tone[status] ?? "text-white/50"}`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${status === "ok" ? "pulse-dot" : ""}`} aria-hidden />
      {status.replace("_", " ")}
    </span>
  );
}

export function runChipStatus(s: RunRecord["status"]) {
  return s === "succeeded" ? "ok" : s === "partial_failure" ? "partial" : s === "failed" ? "error" : s;
}

export function SourceStatus({ run, timeZone }: { run: RunRecord | null; timeZone: string }) {
  if (!run) {
    return <p className="text-sm text-white/60">No discovery run yet. Use “Refresh events” (admin) or wait for the Monday job.</p>;
  }
  const ai: AiStatus | null = run.ai_status;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-white/50">
        <span>
          {new Date(run.started_at).toLocaleString("en-IN", { timeZone, dateStyle: "medium", timeStyle: "short" })} · {run.trigger_type.replace("_", " ")}
        </span>
        <StatusChip status={runChipStatus(run.status)} />
      </div>
      <ul className="divide-y divide-white/5">
        {run.source_status.map((s) => (
          <li key={s.source} className="py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-white/90">{s.source}</span>
              <StatusChip status={s.status} />
            </div>
            <p className="mt-0.5 text-xs text-white/40">{s.message}</p>
          </li>
        ))}
        {ai ? (
          <li className="py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-white/90">Gemini Flash{ai.model ? ` · ${ai.model}` : ""}</span>
              <StatusChip status={ai.status} />
            </div>
            <p className="mt-0.5 text-xs text-white/40">
              {ai.message}
              {ai.calls ? ` · ${ai.calls} call(s), ${ai.failures} failed` : ""}
            </p>
          </li>
        ) : null}
      </ul>
      {run.error_summary ? <p className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-amber-200/80">{run.error_summary}</p> : null}
    </div>
  );
}

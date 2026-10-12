import type { DeadlineInfo } from "@/lib/types";
import { formatDeadline } from "@/lib/time";

const base = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em]";

export function UrgencyBadge({ deadline, iso, timeZone }: { deadline: DeadlineInfo; iso: string | null; timeZone: string }) {
  if (deadline.status === "urgent") {
    return (
      <span className={`${base} bg-lime font-bold text-black shadow-[0_0_20px_rgba(204,255,0,0.35)]`}>
        <span aria-hidden>⚠</span> {deadline.label}
        {iso ? ` · ${formatDeadline(iso, timeZone)}` : ""}
      </span>
    );
  }
  if (deadline.status === "closed") {
    return <span className={`${base} bg-white/10 text-white/50`}>Registration closed</span>;
  }
  if (deadline.status === "open" && iso) {
    return <span className={`${base} border border-emerald-glow/40 text-emerald-300`}>Deadline {formatDeadline(iso, timeZone)}</span>;
  }
  return <span className={`${base} border border-white/15 text-white/60`}>Deadline not listed — verify</span>;
}

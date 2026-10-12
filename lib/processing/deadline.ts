import type { DeadlineInfo } from "../types";
import { DAY_MS } from "../time";

export const URGENT_WINDOW_MS = 7 * DAY_MS;

/**
 * Deadline rule (code-enforced, never delegated to the model):
 * - unknown  : no registration deadline in the source data
 * - closed   : deadline <= now
 * - urgent   : 0 < deadline - now < 7 days  (exactly 7 days is NOT urgent)
 * - open     : deadline - now >= 7 days
 */
export function deadlineStatus(deadlineIso: string | null, now: Date): DeadlineInfo {
  if (!deadlineIso) {
    return { status: "unknown", msRemaining: null, label: "Deadline not listed — verify on source" };
  }
  const t = Date.parse(deadlineIso);
  if (Number.isNaN(t)) {
    return { status: "unknown", msRemaining: null, label: "Deadline not listed — verify on source" };
  }
  const ms = t - now.getTime();
  if (ms <= 0) return { status: "closed", msRemaining: ms, label: "Registration closed" };
  if (ms < URGENT_WINDOW_MS) {
    const days = Math.floor(ms / DAY_MS);
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const label = days >= 1 ? `Registration closes in ${days} day${days === 1 ? "" : "s"}` : `Registration closes in ${Math.max(hours, 1)}h`;
    return { status: "urgent", msRemaining: ms, label };
  }
  return { status: "open", msRemaining: ms, label: "Registration open" };
}

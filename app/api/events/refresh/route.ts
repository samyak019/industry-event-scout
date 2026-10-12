import { isAdmin, isCronAuthorized } from "@/lib/auth";
import { runManualRefresh } from "@/lib/jobs";

export const maxDuration = 300;

/** Authorized manual live refresh (admin session cookie, or Bearer CRON_SECRET for scripts). */
export async function POST(request: Request) {
  if (!(await isAdmin()) && !isCronAuthorized(request)) {
    return Response.json({ error: "Unauthorized — sign in as admin first" }, { status: 401 });
  }
  const outcome = await runManualRefresh(new Date(), Date.now() + (maxDuration - 25) * 1000);
  const code = outcome.status === "failed" ? 500 : outcome.status === "skipped" ? 429 : 200;
  return Response.json(outcome, { status: code });
}

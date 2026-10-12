import { isCronAuthorized } from "@/lib/auth";
import { runWeeklyDigest } from "@/lib/jobs";

export const maxDuration = 300;

/**
 * Vercel Cron target (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`.
 * Idempotent: repeated calls in the same week return "skipped" instead of re-sending.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const outcome = await runWeeklyDigest(new Date(), Date.now() + (maxDuration - 25) * 1000);
  console.log(JSON.stringify({ app: "industry-event-scout", stage: "cron", status: outcome.status, message: outcome.message }));
  return Response.json(outcome, { status: outcome.status === "failed" ? 500 : 200 });
}

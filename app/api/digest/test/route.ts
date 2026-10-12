import { isAdmin } from "@/lib/auth";
import { sendTestDigest } from "@/lib/jobs";

/** Protected test-email endpoint; independent of the scheduled run and its idempotency key. */
export async function POST() {
  if (!(await isAdmin())) {
    return Response.json({ error: "Unauthorized — sign in as admin first" }, { status: 401 });
  }
  const outcome = await sendTestDigest();
  return Response.json(outcome, { status: outcome.status === "succeeded" ? 200 : 502 });
}

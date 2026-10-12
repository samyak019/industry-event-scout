import { isAdmin } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { PreferencesInput } from "@/lib/validation";

type SaveState = { ok: boolean; message: string; errors?: Record<string, string> };

/** Save preferences (admin only). Validated with Zod; takes effect on the next read/refresh. */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ ok: false, message: "Sign in as admin to change preferences." } satisfies SaveState, { status: 401 });
  }
  const formData = await request.formData();
  const raw = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const parsed = PreferencesInput.safeParse({ ...raw, allow_online_events: formData.get("allow_online_events") ?? false });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
    return Response.json({ ok: false, message: "Please fix the highlighted fields.", errors } satisfies SaveState, { status: 400 });
  }
  try {
    const store = getStore();
    await store.savePreferences(parsed.data);
    return Response.json({
      ok: true,
      message:
        store.kind === "memory"
          ? "Saved in server memory only (Supabase not configured). Run “Refresh events” to re-query sources."
          : "Saved. Filters apply immediately; run “Refresh events” to re-query sources and re-score with the new preferences.",
    } satisfies SaveState);
  } catch (err) {
    return Response.json({ ok: false, message: err instanceof Error ? err.message : "Could not save preferences" } satisfies SaveState, { status: 500 });
  }
}

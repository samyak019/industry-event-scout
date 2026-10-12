"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/** Calls a protected POST endpoint and shows the server's honest outcome message. */
export function ActionButton({ endpoint, label, busyLabel, variant = "primary" }: { endpoint: string; label: string; busyLabel: string; variant?: "primary" | "secondary" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      setMessage({ ok: res.ok, text: body.message ?? body.error ?? `HTTP ${res.status}` });
      startTransition(() => router.refresh());
    } catch {
      setMessage({ ok: false, text: "Request failed — check your connection" });
    } finally {
      setBusy(false);
    }
  }

  const cls =
    variant === "primary"
      ? "btn-neon px-7 py-3.5 text-base"
      : "rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-lime/50 disabled:opacity-50";
  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" onClick={run} disabled={busy} className={cls} aria-busy={busy}>
        {busy ? busyLabel : label}
      </button>
      {busy && endpoint.includes("refresh") ? <span className="mono-tag text-white/50">Querying live sources + Gemini · up to ~2 min</span> : null}
      {message ? (
        <span role="status" className={`max-w-sm text-xs ${message.ok ? "text-lime" : "text-red-400"}`}>
          {message.text}
        </span>
      ) : null}
    </div>
  );
}

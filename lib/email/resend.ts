import "server-only";
import { Resend } from "resend";
import { env } from "../env";

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; error: string; notConfigured?: boolean };

/**
 * Sends through Resend. Success is reported ONLY when Resend returns an email id.
 * Note: with Resend's shared onboarding sender, mail can only go to the Resend
 * account owner's address; other recipients require a verified domain.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
}): Promise<SendResult> {
  const key = env.resendApiKey();
  const from = env.resendFrom();
  if (!key || !from) return { ok: false, error: "RESEND_API_KEY / RESEND_FROM_EMAIL not set", notConfigured: true };
  try {
    const resend = new Resend(key);
    const { data, error } = await resend.emails.send(
      { from, to: [opts.to], subject: opts.subject, html: opts.html, text: opts.text },
      opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined,
    );
    if (error || !data?.id) return { ok: false, error: error?.message ?? "Resend did not return an email id" };
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Resend request failed" };
  }
}

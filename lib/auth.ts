import "server-only";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "./env";

/**
 * Single-user prototype auth: one admin password (ADMIN_PASSWORD) unlocks
 * settings, manual refresh and test email via an httpOnly session cookie.
 * The cron endpoint is protected separately by CRON_SECRET.
 */

export const ADMIN_COOKIE = "ies_admin";

export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function adminToken(): string | null {
  const pw = env.adminPassword();
  if (!pw) return null;
  return createHmac("sha256", pw).update("industry-event-scout:admin:v1").digest("hex");
}

export async function isAdmin(): Promise<boolean> {
  const expected = adminToken();
  if (!expected) return false;
  const jar = await cookies();
  const value = jar.get(ADMIN_COOKIE)?.value;
  return Boolean(value && safeEqual(value, expected));
}

export function checkPassword(input: string): boolean {
  const pw = env.adminPassword();
  return Boolean(pw && input && safeEqual(input, pw));
}

/** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. */
export function isCronAuthorized(request: Request): boolean {
  const secret = env.cronSecret();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return safeEqual(header, `Bearer ${secret}`);
}

import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminToken, checkPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const token = adminToken();
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=not-configured", request.url), 303);
  }
  if (!checkPassword(password)) {
    // Small fixed delay to slow brute-force attempts.
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.redirect(new URL(`/login?error=invalid&next=${encodeURIComponent(safeNext)}`, request.url), 303);
  }
  const res = NextResponse.redirect(new URL(safeNext, request.url), 303);
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return res;
}

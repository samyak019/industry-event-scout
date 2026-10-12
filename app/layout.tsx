import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { isAdmin } from "@/lib/auth";
import { NavPill } from "@/components/nav-pill";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Industry Event Scout",
  description: "AI-ranked weekly digest of professional events from live sources, with registration-deadline alerts.",
};

async function AuthControl() {
  const admin = await isAdmin();
  return admin ? (
    <form action="/api/auth/logout" method="post">
      <button className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-transform duration-300 hover:scale-105">Sign out</button>
    </form>
  ) : (
    <Link href="/login" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-transform duration-300 hover:scale-105">
      Sign in
    </Link>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-shell p-2 sm:p-4">
        <div className="noise relative mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1600px] flex-col overflow-hidden rounded-[2.5rem] bg-surface shadow-2xl ring-1 ring-white/10">
          <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" aria-hidden />
          <div className="glow-sphere -left-40 -top-40 h-[480px] w-[480px] bg-lime/20" aria-hidden />
          <div className="glow-sphere -right-32 top-[30rem] h-[380px] w-[380px] bg-emerald-glow/15" aria-hidden />

          <header className="relative z-20 flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-8">
            <Link href="/" className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-lime text-lg font-bold text-black">E</span>
              <span className="hidden font-semibold tracking-tight text-white sm:inline">Event Scout</span>
            </Link>
            <div className="order-3 w-full sm:order-none sm:w-auto">
              <NavPill />
            </div>
            <div className="flex items-center gap-4">
              <span className="mono-tag hidden items-center gap-2 text-white/60 lg:flex">
                <span className="pulse-dot" aria-hidden /> Live sources
              </span>
              <Suspense fallback={<span className="h-9 w-20 rounded-full bg-white/10" />}>
                <AuthControl />
              </Suspense>
            </div>
          </header>

          <main className="relative z-10 w-full flex-1">{children}</main>

          <footer className="relative z-10 overflow-hidden bg-black px-5 pb-8 pt-28 sm:px-8 sm:pt-44">
            <div className="display pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 select-none text-[5rem] font-bold leading-none text-white/[0.04] sm:text-[10rem]" aria-hidden>
              SCOUT
            </div>
            <div className="relative flex flex-col items-center gap-6 text-center">
              <p className="mono-tag text-white/50">Every Monday · 08:00 IST</p>
              <h2 className="display max-w-2xl text-3xl font-semibold text-white sm:text-5xl">Never miss the room that matters.</h2>
              <Link href="/digest" className="btn-neon btn-slide px-8 py-4 text-base sm:px-10 sm:py-5 sm:text-lg">
                Open this week&apos;s digest →
              </Link>
            </div>
            <div className="relative mt-16 grid gap-6 border-t border-white/10 pt-6 text-sm text-white/60 sm:grid-cols-3">
              <div className="flex gap-4">
                <Link href="/settings" className="hover:text-white">Preferences</Link>
                <Link href="/digest" className="hover:text-white">Run history</Link>
              </div>
              <div className="flex items-center gap-3 sm:justify-center">
                <a href="https://luma.com" target="_blank" rel="noopener noreferrer" aria-label="Luma (event source)" className="grid h-9 w-9 place-items-center rounded-full border border-white/20 font-mono text-[11px] hover:border-lime/60 hover:text-lime">LU</a>
                <a href="https://allevents.in" target="_blank" rel="noopener noreferrer" aria-label="AllEvents.in (event source)" className="grid h-9 w-9 place-items-center rounded-full border border-white/20 font-mono text-[11px] hover:border-lime/60 hover:text-lime">AE</a>
                <a href="https://tavily.com" target="_blank" rel="noopener noreferrer" aria-label="Tavily (web search)" className="grid h-9 w-9 place-items-center rounded-full border border-white/20 font-mono text-[11px] hover:border-lime/60 hover:text-lime">TV</a>
              </div>
              <p className="mono-tag text-white/40 sm:text-right">© Industry Event Scout · Gemini Flash</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

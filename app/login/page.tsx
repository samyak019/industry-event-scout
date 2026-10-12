import { Suspense } from "react";

type SP = Promise<Record<string, string | string[] | undefined>>;

async function LoginForm({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const next = typeof sp.next === "string" ? sp.next : "/";
  return (
    <div className="px-5 pb-24 pt-10 sm:px-8">
      <form action="/api/auth/login" method="post" className="glass float-anim mx-auto max-w-md space-y-5 rounded-[2.5rem] p-8">
        <p className="mono-tag flex items-center gap-2 text-lime">
          <span className="pulse-dot" aria-hidden /> Admin access
        </p>
        <h1 className="display text-4xl font-semibold text-white">Sign in</h1>
        <p className="text-sm text-white/60">Required to edit preferences, run a live refresh or send a test email.</p>
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-2">
          <span className="mono-tag text-white/50">Password</span>
          <input type="password" name="password" required autoComplete="current-password" className="field px-4 py-3" />
        </label>
        {error === "invalid" ? <p role="alert" className="text-sm text-red-400">Incorrect password.</p> : null}
        {error === "not-configured" ? <p role="alert" className="text-sm text-red-400">ADMIN_PASSWORD is not configured on the server.</p> : null}
        <button className="btn-neon w-full px-6 py-3.5">Sign in</button>
      </form>
    </div>
  );
}

export default function Page({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={null}>
      <LoginForm searchParams={searchParams} />
    </Suspense>
  );
}

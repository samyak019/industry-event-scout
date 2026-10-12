/** Placeholder shapes that mirror the real layout while data streams in. */

function Bar({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function HeroActionsSkeleton() {
  return <Bar className="h-[52px] w-44 rounded-full" />;
}

export function HeroPanelSkeleton() {
  return (
    <div className="glass-blur relative overflow-hidden rounded-[2.5rem] p-5 sm:p-6" aria-busy="true" aria-label="Loading top matches">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-lime/80" />
        </div>
        <span className="mono-tag flex items-center gap-2 text-white/40">
          <span className="pulse-dot" aria-hidden /> scouting
        </span>
      </div>
      <div className="mt-6 space-y-4">
        {[0, 1].map((i) => (
          <div key={i} className={`glass rounded-[1.5rem] p-4 ${i ? "ml-6" : ""}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2.5">
                <Bar className="h-2.5 w-28" />
                <Bar className="h-4 w-4/5" />
                <Bar className="h-2.5 w-20" />
              </div>
              <Bar className="h-8 w-10" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-16" aria-hidden />
    </div>
  );
}

export function BentoSkeleton() {
  const card = "glass relative overflow-hidden rounded-[2.5rem] p-6";
  return (
    <section className="grid gap-4 px-5 sm:grid-cols-2 sm:px-8 lg:auto-rows-[200px] lg:grid-cols-4" aria-busy="true" aria-label="Loading overview">
      <div className={`${card} sm:col-span-2 lg:row-span-2`}>
        <Bar className="h-2.5 w-48" />
        <Bar className="mt-4 h-14 w-24" />
        <div className="mt-6 flex h-[170px] items-end gap-3 sm:gap-5">
          {[70, 100, 55, 30, 15].map((h, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <div className="skeleton w-full rounded-b-none rounded-t-2xl" style={{ height: `${h + 10}px` }} aria-hidden />
              <Bar className="h-2 w-6" />
            </div>
          ))}
        </div>
      </div>
      <div className={`${card} lg:row-span-2`}>
        <Bar className="h-2.5 w-28" />
        <div className="mt-5 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Bar className="h-10 w-10 shrink-0" />
              <div className="flex-1 space-y-2">
                <Bar className="h-3 w-3/4" />
                <Bar className="h-2 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="relative overflow-hidden rounded-[2.5rem] bg-lime/80 p-6">
        <div className="h-2.5 w-32 rounded-full bg-black/15" />
        <div className="mt-4 h-14 w-14 rounded-xl bg-black/15" />
      </div>
      <div className={card}>
        <Bar className="h-2.5 w-28" />
        <div className="mt-5 space-y-3">
          <Bar className="h-3 w-full" />
          <Bar className="h-3 w-full" />
          <Bar className="h-3 w-2/3" />
        </div>
      </div>
    </section>
  );
}

function EventCardSkeleton() {
  return (
    <div className="glass rounded-[2rem] p-5 sm:p-6" aria-hidden>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex gap-2">
            <Bar className="h-6 w-40 rounded-full" />
            <Bar className="h-6 w-20 rounded-full" />
          </div>
          <Bar className="mt-4 h-6 w-3/4" />
          <Bar className="mt-3 h-3 w-1/2" />
        </div>
        <Bar className="h-10 w-12" />
      </div>
      <Bar className="mt-5 h-3 w-full" />
      <Bar className="mt-2 h-3 w-5/6" />
      <div className="mt-5 flex gap-3">
        <Bar className="h-9 w-40 rounded-full" />
        <Bar className="h-9 w-24 rounded-full" />
      </div>
    </div>
  );
}

export function EventsSkeleton() {
  return (
    <>
      <div className="min-w-0 space-y-5" aria-busy="true" aria-label="Loading events">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="display text-3xl font-semibold text-white sm:text-4xl">Ranked events</h2>
          <Bar className="h-10 w-80 rounded-full" />
        </div>
        <div className="glass grid grid-cols-2 gap-3 rounded-[2rem] p-4 sm:grid-cols-3 lg:grid-cols-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Bar className="h-2 w-12" />
              <Bar className="h-9 w-full" />
            </div>
          ))}
        </div>
        <p className="mono-tag flex items-center gap-2 text-white/40">
          <span className="pulse-dot" aria-hidden /> Ranking events…
        </p>
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      </div>
      <aside className="space-y-4">
        <div className="glass rounded-[2rem] p-6">
          <Bar className="h-2.5 w-32" />
          <div className="mt-5 space-y-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Bar className="h-3 w-2/3" />
                <Bar className="h-2 w-full" />
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}

/** Generic page skeleton for Settings / Digest. */
export function PanelSkeleton({ rows = 6, tall = false }: { rows?: number; tall?: boolean }) {
  return (
    <div className="glass rounded-[2.5rem] p-6 sm:p-8" aria-busy="true" aria-label="Loading">
      {tall ? (
        <Bar className="h-[520px] w-full rounded-[1.5rem]" />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="space-y-2">
              <Bar className="h-2.5 w-32" />
              <Bar className="h-24 w-full rounded-2xl" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

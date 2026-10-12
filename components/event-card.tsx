import type { ClassifiedEvent } from "@/lib/types";
import { formatEventDate } from "@/lib/time";
import { UrgencyBadge } from "./urgency-badge";

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Score({ e }: { e: ClassifiedEvent }) {
  if (e.relevance_score === null) {
    return <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">Not assessed</div>;
  }
  return (
    <div className="flex flex-col items-end" title={e.assessment_method === "rules" ? "Rules-based fallback score (AI unavailable)" : "Gemini Flash assessment"}>
      <span className={`display text-4xl font-semibold leading-none ${e.relevance_score >= 70 ? "text-lime" : "text-white"}`}>{e.relevance_score}</span>
      <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">{e.assessment_method === "rules" ? "Rules match" : "AI match"}</span>
    </div>
  );
}

export function EventCard({ e, rank, timeZone }: { e: ClassifiedEvent; rank?: number; timeZone: string }) {
  const where = e.is_online ? "Online" : [e.city, e.venue && e.venue !== e.city ? e.venue : null].filter(Boolean).join(" · ") || "Location not listed";
  return (
    <article
      className={`glass group rounded-[2rem] p-5 transition-colors duration-300 hover:border-lime/40 sm:p-6 ${e.deadline.status === "urgent" ? "border-lime/50" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {rank ? <span className="font-mono text-[11px] text-white/40">{String(rank).padStart(2, "0")}</span> : null}
            <UrgencyBadge deadline={e.deadline} iso={e.registration_deadline} timeZone={timeZone} />
            {e.format ? <span className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-white/60">{e.format}</span> : null}
            {e.matched_domains.map((d) => (
              <span key={d} className="rounded-full bg-emerald-glow/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-300">{d}</span>
            ))}
          </div>
          <h3 className="display mt-3 text-xl font-semibold leading-tight text-white sm:text-2xl">{e.title}</h3>
          <p className="mt-2 font-mono text-xs text-white/60">
            {formatEventDate(e, timeZone)} <span className="text-white/25">/</span> {where}
          </p>
          {e.organizer ? <p className="mt-1 text-xs text-white/40">Organiser: {e.organizer}</p> : null}
        </div>
        <Score e={e} />
      </div>

      {e.ai_summary ? (
        <p className="mt-4 text-[15px] leading-relaxed text-white/80">{e.ai_summary}</p>
      ) : e.description ? (
        <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-white/60">{e.description}</p>
      ) : null}
      {e.match_reason ? (
        <p className="mt-3 border-l-2 border-lime pl-3 text-sm text-white/80">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime">Why it matches</span>
          <br />
          {e.match_reason}
        </p>
      ) : null}
      {e.reasons.length ? <p className="mt-3 font-mono text-[11px] text-amber-300/80">{e.reasons.join(" · ")}</p> : null}

      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
        {e.registration_url ? (
          <a href={e.registration_url} target="_blank" rel="noopener noreferrer" className="btn-neon px-5 py-2 text-sm">
            Register
          </a>
        ) : null}
        <a
          href={e.event_url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-white/15 px-4 py-2 text-white/80 transition-colors hover:border-lime/50 hover:text-white"
        >
          Event page · {host(e.event_url)} ↗
        </a>
        <details className="w-full text-xs text-white/50 sm:w-auto">
          <summary className="cursor-pointer select-none font-mono uppercase tracking-[0.15em] hover:text-white/80">Sources ({e.sources.length})</summary>
          <ul className="mt-2 space-y-1 font-mono text-[11px]">
            {e.sources.map((s) => (
              <li key={s.source_url}>
                {s.source_name}:{" "}
                <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="break-all text-lime/80 hover:text-lime">
                  {s.source_url}
                </a>{" "}
                · {new Date(s.discovered_at).toLocaleString("en-IN", { timeZone })}
              </li>
            ))}
            <li>Extraction: {e.extraction_method === "json-ld" ? "schema.org JSON-LD" : e.extraction_method === "eventbrite-api" ? "Eventbrite API" : "Gemini, grounded on quoted source text"}</li>
            {e.deadline_source ? <li>Deadline from: {e.deadline_source}</li> : null}
            {e.data_notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </details>
      </div>
    </article>
  );
}

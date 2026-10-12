import type { ClassifiedEvent, Preferences } from "../types";
import { formatDeadline, formatEventDate, localDate } from "../time";
import { WINDOW_DAYS, windowBounds } from "../processing/filter";
import { selectDigestEvents } from "../processing/rank";

/**
 * One renderer for the preview page, the test email and the scheduled email,
 * so what is previewed is exactly what is sent. All event text is HTML-escaped.
 */

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function safeHref(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? escapeHtml(u.toString()) : null;
  } catch {
    return null;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export type DigestContent = {
  subject: string;
  html: string;
  text: string;
  events: ClassifiedEvent[];
  urgentCount: number;
};

export function buildDigest(all: ClassifiedEvent[], prefs: Preferences, now: Date, appUrl: string): DigestContent {
  const events = selectDigestEvents(all, prefs.max_digest_events);
  const actionableTotal = all.filter((e) => e.bucket === "actionable").length;
  const verifyCount = all.filter((e) => e.bucket === "needs_verification").length;
  const urgent = events.filter((e) => e.deadline.status === "urgent");
  const tz = prefs.timezone;
  const { end } = windowBounds(now);
  const range = `${localDate(now, tz)} → ${localDate(end, tz)}`;
  const weekOf = new Intl.DateTimeFormat("en-IN", { timeZone: tz, day: "numeric", month: "short", year: "numeric" }).format(now);
  const subject = events.length
    ? `Event Scout · ${events.length} event${events.length === 1 ? "" : "s"} for week of ${weekOf}${urgent.length ? ` · ${urgent.length} deadline${urgent.length === 1 ? "" : "s"} closing soon` : ""}`
    : `Event Scout · No matching events this week (${weekOf})`;
  const dash = safeHref(appUrl) ?? "#";

  const card = (e: ClassifiedEvent, i: number) => {
    const where = e.is_online ? "Online" : [e.city, e.venue && e.venue !== e.city ? e.venue : null].filter(Boolean).join(" · ") || "Location not listed";
    const reg = safeHref(e.registration_url);
    const src = safeHref(e.event_url);
    const urgentBadge =
      e.deadline.status === "urgent"
        ? `<div style="display:inline-block;background:#b42318;color:#fff;font-size:12px;font-weight:700;padding:3px 8px;border-radius:4px;margin-bottom:6px;">⚠ ${escapeHtml(e.deadline.label)}${e.registration_deadline ? ` — ${escapeHtml(formatDeadline(e.registration_deadline, tz))}` : ""}</div>`
        : "";
    const deadlineLine =
      e.deadline.status === "unknown"
        ? "Deadline not listed — verify on source"
        : e.deadline.status === "open" && e.registration_deadline
          ? `Registration deadline: ${formatDeadline(e.registration_deadline, tz)}`
          : "";
    const score =
      e.relevance_score !== null
        ? `${e.relevance_score}/100${e.assessment_method === "rules" ? " (rules-based)" : ""}`
        : "not assessed";
    const summary = e.ai_summary ?? e.description?.slice(0, 220) ?? "";
    return `
<tr><td style="padding:14px 0;border-top:1px solid #e4e7ec;">
  ${urgentBadge}
  <div style="font-size:16px;font-weight:700;color:#101828;line-height:1.3;">${i + 1}. ${escapeHtml(e.title)}</div>
  <div style="font-size:13px;color:#344054;margin-top:4px;">📅 ${escapeHtml(formatEventDate(e, tz))} &nbsp;·&nbsp; 📍 ${escapeHtml(where)}</div>
  ${e.organizer ? `<div style="font-size:12px;color:#667085;margin-top:2px;">Organiser: ${escapeHtml(e.organizer)}</div>` : ""}
  ${summary ? `<div style="font-size:14px;color:#344054;margin-top:8px;line-height:1.45;">${escapeHtml(summary)}</div>` : ""}
  ${e.match_reason ? `<div style="font-size:13px;color:#155eef;margin-top:6px;"><strong>Why it matches:</strong> ${escapeHtml(e.match_reason)} <span style="color:#667085;">· Relevance ${escapeHtml(score)}</span></div>` : ""}
  ${deadlineLine ? `<div style="font-size:12px;color:#667085;margin-top:4px;">${escapeHtml(deadlineLine)}</div>` : ""}
  <div style="font-size:13px;margin-top:8px;">
    ${reg ? `<a href="${reg}" style="color:#fff;background:#155eef;padding:6px 10px;border-radius:4px;text-decoration:none;font-weight:600;">Register</a>&nbsp;&nbsp;` : ""}
    ${src ? `<a href="${src}" style="color:#155eef;">${reg ? "Event page" : "Event page / register"} (${escapeHtml(hostOf(e.event_url))})</a>` : ""}
    <span style="color:#98a2b3;font-size:11px;">&nbsp;· via ${escapeHtml(e.source_name)}</span>
  </div>
</td></tr>`;
  };

  const intro = events.length
    ? `${events.length} of ${actionableTotal} matching event${actionableTotal === 1 ? "" : "s"} in the next ${WINDOW_DAYS} days, ranked by relevance.${urgent.length ? ` <strong style="color:#b42318;">${urgent.length} registration deadline${urgent.length === 1 ? " closes" : "s close"} within 7 days.</strong>` : ""}`
    : `No events matched your domains, categories and cities for the next ${WINDOW_DAYS} days in the sources checked. Nothing has been padded or invented.`;

  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f2f4f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f7;"><tr><td align="center" style="padding:16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:8px;padding:20px;">
<tr><td>
  <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#155eef;font-weight:700;">Industry Event Scout · Weekly digest</div>
  <div style="font-size:20px;font-weight:700;color:#101828;margin-top:4px;">Events worth attending · ${escapeHtml(range)}</div>
  <div style="font-size:14px;color:#475467;margin-top:8px;line-height:1.5;">${intro}</div>
  <div style="font-size:12px;color:#667085;margin-top:6px;">Focus: ${escapeHtml(prefs.domains.join(", ") || "—")} · Cities: ${escapeHtml(prefs.cities.join(", ") || "—")}${prefs.allow_online_events ? " + online" : ""}</div>
</td></tr>
${events.map(card).join("")}
<tr><td style="padding-top:16px;border-top:1px solid #e4e7ec;font-size:12px;color:#667085;line-height:1.5;">
  ${verifyCount ? `${verifyCount} more event${verifyCount === 1 ? "" : "s"} need${verifyCount === 1 ? "s" : ""} verification (date or location not established). ` : ""}<a href="${dash}" style="color:#155eef;">Open the dashboard</a> for the full list, sources and filters.<br>
  Relevance scores and summaries are AI assessments by Gemini Flash (or a labelled rules-based fallback), not verified facts. Dates, locations, deadlines and links come from the original sources — please verify before registering.
</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    subject,
    "",
    events.length ? `${events.length} of ${actionableTotal} matching events in the next ${WINDOW_DAYS} days.` : "No matching events this week in the sources checked.",
    "",
    ...events.map((e, i) =>
      [
        `${i + 1}. ${e.deadline.status === "urgent" ? `[URGENT: ${e.deadline.label}] ` : ""}${e.title}`,
        `   ${formatEventDate(e, tz)} · ${e.is_online ? "Online" : e.city ?? "Location not listed"}`,
        e.match_reason ? `   Why: ${e.match_reason}` : null,
        `   ${e.deadline.status === "unknown" ? "Deadline not listed — verify on source" : e.deadline.label}`,
        e.registration_url ? `   Register: ${e.registration_url}` : null,
        `   Source: ${e.event_url}`,
        "",
      ]
        .filter((l) => l !== null)
        .join("\n"),
    ),
    `Dashboard: ${appUrl}`,
  ].join("\n");

  return { subject, html, text, events, urgentCount: urgent.length };
}

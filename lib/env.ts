import "server-only";

/**
 * Server-side environment access. Every integration asks for its own variables
 * when it is used, so a missing key disables one feature with a clear message
 * instead of crashing the whole app.
 */

function read(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export const env = {
  supabaseUrl: () => read("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseServiceRoleKey: () => read("SUPABASE_SERVICE_ROLE_KEY"),
  geminiApiKey: () => read("GEMINI_API_KEY"),
  // `gemini-flash-latest` is Google's alias for the current Flash model.
  // Pin a specific Flash model ID via GEMINI_MODEL if you need reproducibility.
  geminiModel: () => read("GEMINI_MODEL") ?? "gemini-flash-latest",
  tavilyApiKey: () => read("TAVILY_API_KEY"),
  eventbriteToken: () => read("EVENTBRITE_API_TOKEN"),
  eventbriteOrganizerIds: () =>
    (read("EVENTBRITE_ORGANIZER_IDS") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  resendApiKey: () => read("RESEND_API_KEY"),
  resendFrom: () => read("RESEND_FROM_EMAIL"),
  digestToEmail: () => read("DIGEST_TO_EMAIL"),
  cronSecret: () => read("CRON_SECRET"),
  adminPassword: () => read("ADMIN_PASSWORD"),
  appUrl: () => read("APP_URL") ?? (read("VERCEL_PROJECT_PRODUCTION_URL") ? `https://${read("VERCEL_PROJECT_PRODUCTION_URL")}` : "http://localhost:3000"),
  defaultTimezone: () => read("DEFAULT_TIMEZONE") ?? "Asia/Kolkata",
};

/** Non-secret summary of which integrations are configured, safe to show in the UI. */
export function configStatus() {
  return {
    supabase: Boolean(env.supabaseUrl() && env.supabaseServiceRoleKey()),
    gemini: Boolean(env.geminiApiKey()),
    geminiModel: env.geminiModel(),
    tavily: Boolean(env.tavilyApiKey()),
    eventbrite: Boolean(env.eventbriteToken() && env.eventbriteOrganizerIds().length),
    resend: Boolean(env.resendApiKey() && env.resendFrom()),
    cronSecret: Boolean(env.cronSecret()),
    adminPassword: Boolean(env.adminPassword()),
  };
}

function toAppUrl(value) {
  if (!value) return "";
  const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return normalized.replace(/\/$/, "");
}

module.exports = function handler(_request, response) {
  const appUrl = toAppUrl(process.env.PUBLIC_APP_URL || process.env.VERCEL_URL);

  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Content-Type", "application/javascript; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.status(200).send(
    `window.VitrinOSRuntimeConfig = ${JSON.stringify({
      environment: process.env.VERCEL_ENV || "development",
      appUrl,
      supabaseUrl: process.env.SUPABASE_URL || "",
      supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || "",
      supabaseProjectRef: process.env.SUPABASE_PROJECT_REF || "",
      contactEmail: process.env.PUBLIC_CONTACT_EMAIL || ""
    })};`
  );
};

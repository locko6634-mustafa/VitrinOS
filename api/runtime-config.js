function toAppUrl(value) {
  if (!value) return "";
  const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return normalized.replace(/\/$/, "");
}

const PRODUCTION_DEFAULTS = {
  supabaseUrl: "https://wrzalebhnlwppufdcmiz.supabase.co",
  supabasePublishableKey: "sb_publishable_VqmAXSH5VRyyUBERRaUMEg_GQkuBgun",
  supabaseProjectRef: "wrzalebhnlwppufdcmiz",
  sentryDsn: "",
  observabilitySampleRate: 1.0,
  release: "vitrinos-web@1.0.0"
};

function handler(_request, response) {
  const appUrl = toAppUrl(process.env.PUBLIC_APP_URL || process.env.VERCEL_URL);
  const isProduction = (process.env.VERCEL_ENV || "development") === "production";
  const defaults = isProduction ? PRODUCTION_DEFAULTS : {
    sentryDsn: "",
    observabilitySampleRate: 1.0,
    release: "vitrinos-web@1.0.0"
  };

  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Content-Type", "application/javascript; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.status(200).send(
    `window.VitrinOSRuntimeConfig = ${JSON.stringify({
      environment: process.env.VERCEL_ENV || "development",
      appUrl,
      supabaseUrl: process.env.SUPABASE_URL || defaults.supabaseUrl || "",
      supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || defaults.supabasePublishableKey || "",
      supabaseProjectRef: process.env.SUPABASE_PROJECT_REF || defaults.supabaseProjectRef || "",
      contactEmail: process.env.PUBLIC_CONTACT_EMAIL || "",
      sentryDsn: process.env.SENTRY_DSN || process.env.PUBLIC_SENTRY_DSN || defaults.sentryDsn || "",
      observabilitySampleRate: process.env.OBSERVABILITY_SAMPLE_RATE ? parseFloat(process.env.OBSERVABILITY_SAMPLE_RATE) : defaults.observabilitySampleRate,
      release: process.env.RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || defaults.release || ""
    })};`
  );
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = handler;
} else if (typeof window !== "undefined") {
  // Yerel statik sunucuda serverless kaynak dosyası doğrudan yüklenirse güvenli fallback.
  window.VitrinOSRuntimeConfig = window.VitrinOSRuntimeConfig || {};
}

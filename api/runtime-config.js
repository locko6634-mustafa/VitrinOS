function toAppUrl(value) {
  if (!value) return "";
  const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return normalized.replace(/\/$/, "");
}

const PRODUCTION_DEFAULTS = {
  sentryDsn: "",
  observabilitySampleRate: 1.0,
  release: "vitrinos-web@1.0.0"
};

function handler(_request, response) {
  const appUrl = toAppUrl(process.env.PUBLIC_APP_URL || process.env.APP_URL);
  const isProduction = (process.env.APP_ENV || process.env.NODE_ENV || "development") === "production";
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
      environment: process.env.APP_ENV || process.env.NODE_ENV || "development",
      appUrl,
      contactEmail: process.env.PUBLIC_CONTACT_EMAIL || "",
      sentryDsn: process.env.SENTRY_DSN || process.env.PUBLIC_SENTRY_DSN || defaults.sentryDsn || "",
      observabilitySampleRate: process.env.OBSERVABILITY_SAMPLE_RATE ? parseFloat(process.env.OBSERVABILITY_SAMPLE_RATE) : defaults.observabilitySampleRate,
      release: process.env.RELEASE || process.env.GIT_COMMIT_SHA || defaults.release || ""
    })};`
  );
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = handler;
} else if (typeof window !== "undefined") {
  // Yerel statik sunucuda serverless kaynak dosyası doğrudan yüklenirse güvenli fallback.
  window.VitrinOSRuntimeConfig = window.VitrinOSRuntimeConfig || {};
}

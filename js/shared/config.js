// VitrinOS Çalışma Zamanı Konfigürasyonu (ESM & Shared)
const runtimeConfig = (typeof window !== "undefined" && window.VitrinOSRuntimeConfig) || {};
const currentPath = (typeof window !== "undefined" && window.location?.pathname) || "/";
const appBasePath = currentPath.includes("/VitrinOS/") ? "/VitrinOS/" : "/";
const appUrl = runtimeConfig.appUrl || (
  typeof URL === "function" && typeof window !== "undefined"
    ? new URL(appBasePath, window.location?.origin || "http://localhost").toString()
    : appBasePath
);

const isLocalhost = Boolean(
  typeof window !== "undefined" && (
    window.location?.hostname === "localhost" ||
    window.location?.hostname === "127.0.0.1" ||
    window.location?.hostname === "[::1]"
  )
);

export const defaults = {
  apiBaseUrl: "/api/v1",
  environment: isLocalhost ? "development" : "production",
  appBasePath: runtimeConfig.appBasePath || appBasePath,
  appUrl,
  contactEmail: "",
  external: {
    sentryCdnUrl: "https://browser.sentry-cdn.com/8.55.0/bundle.min.js"
  },
  sentryDsn: "",
  observabilitySampleRate: 1,
  release: "vitrinos-web@1.0.0",
  defaults: {
    colors: {
      primary: "#d9962a",
      secondary: "#7a4f12"
    },
    formats: {
      story: { name: "Story", dimensions: "1080x1920", keywords: ["story", "hikaye", "9:16"] },
      banner: { name: "Banner", dimensions: "1600x600", keywords: ["banner", "1600", "600"] },
      metaPost: { name: "Meta Post", dimensions: "1080x1350", keywords: [] }
    },
    statuses: {
      values: ["queued", "dispatching", "processing", "succeeded", "approved", "failed_retryable", "failed_terminal", "cancelled"],
      labels: {
        queued: "Sırada",
        dispatching: "Gönderiliyor",
        processing: "Üretiliyor",
        succeeded: "Tamamlandı",
        approved: "Onaylandı",
        failed_retryable: "Yeniden Denenecek",
        failed_terminal: "Başarısız",
        cancelled: "İptal Edildi"
      }
    },
    dashboard: {
      jobPageSize: 24,
      briefMinLength: 12,
      revisionMinLength: 6,
      revisionLimit: 3,
      requestTimeoutMs: 15000,
      mobileBreakpoint: 640,
      drawerBreakpoint: 1120
    },
    admin: { pageSize: 25, mobileBreakpoint: 1120 },
    marketingBreakpoint: 960,
    lead: { minSubmitSeconds: 3 }
  }
};

export const config = {
  ...defaults,
  ...runtimeConfig,
  appUrl: runtimeConfig.appUrl || appUrl,
  external: { ...defaults.external, ...(runtimeConfig.external || {}) },
  defaults: { ...defaults.defaults, ...(runtimeConfig.defaults || {}) }
};

if (typeof window !== "undefined") {
  window.VitrinOS = window.VitrinOS || {};
  window.VitrinOS.config = config;

  window.document?.querySelectorAll("[data-config-email]").forEach((element) => {
    const email = config.contactEmail;
    if (!email) {
      element.remove();
      return;
    }
    element.textContent = email;
    element.setAttribute("href", `mailto:${email}`);
  });
}

export default config;

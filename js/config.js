(function () {
  window.VitrinOS = window.VitrinOS || {};

  const runtimeConfig = window.VitrinOSRuntimeConfig || {};
  const currentPath = window.location?.pathname || "/";
  const appBasePath = currentPath.includes("/VitrinOS/") ? "/VitrinOS/" : "/";
  const appUrl = runtimeConfig.appUrl || (
    typeof URL === "function"
      ? new URL(appBasePath, window.location?.origin || "http://localhost").toString()
      : appBasePath
  );

  const isLocalhost = Boolean(
    window.location?.hostname === "localhost" ||
    window.location?.hostname === "127.0.0.1" ||
    window.location?.hostname === "[::1]"
  );

  const defaults = {
    apiBaseUrl: "/api/v1",
    environment: isLocalhost ? "development" : "production",
    appBasePath: runtimeConfig.appBasePath || appBasePath,
    appUrl,
    contactEmail: "",
    leadSubmitFunction: "submit-lead",
    briefTriggerFunction: "trigger-brief",
    sourceImageUploadFunction: "upload-source-image",
    adminUserActionFunction: "admin-user-actions",
    jobActionFunction: "job-actions",
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
        values: ["pending", "processing", "completed", "approved", "failed", "revision_requested", "failed_dispatch", "pending_retry"],
        labels: {
          pending: "Bekliyor",
          processing: "Üretiliyor",
          completed: "Tamamlandı",
          approved: "Onaylandı",
          failed: "Başarısız",
          revision_requested: "Revizyon istendi",
          failed_dispatch: "Tetikleme Başarısız",
          pending_retry: "Yeniden Denenecek"
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

  window.VitrinOS.config = {
    ...defaults,
    ...runtimeConfig,
    appUrl: runtimeConfig.appUrl || appUrl,
    external: { ...defaults.external, ...(runtimeConfig.external || {}) },
    defaults: { ...defaults.defaults, ...(runtimeConfig.defaults || {}) }
  };

  window.document?.querySelectorAll("[data-config-email]").forEach((element) => {
    const email = window.VitrinOS.config.contactEmail;
    if (!email) {
      element.remove();
      return;
    }
    element.textContent = email;
    element.setAttribute("href", `mailto:${email}`);
  });
})();

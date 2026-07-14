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

  window.VitrinOS.config = {
    supabaseUrl: "https://wrzalebhnlwppufdcmiz.supabase.co",
    supabasePublishableKey: "sb_publishable_VqmAXSH5VRyyUBERRaUMEg_GQkuBgun",
    supabaseProjectRef: "wrzalebhnlwppufdcmiz",
    ...runtimeConfig,
    appBasePath: runtimeConfig.appBasePath || appBasePath,
    appUrl,
    contactEmail: runtimeConfig.contactEmail || "",
    leadSubmitFunction: "submit-lead",
    briefTriggerFunction: "trigger-brief",
    adminUserActionFunction: "admin-user-actions",
    jobActionFunction: "job-actions",
    external: {
      sentryCdnUrl: "https://browser.sentry-cdn.com/8.55.0/bundle.min.js"
    },
    sentryDsn: "",
    observabilitySampleRate: 1,
    release: "vitrinos-web@0.1.0",
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
        values: ["pending", "processing", "completed", "approved", "failed", "revision_requested"],
        labels: {
          pending: "Bekliyor",
          processing: "Üretiliyor",
          completed: "Tamamlandı",
          approved: "Onaylandı",
          failed: "Başarısız",
          revision_requested: "Revizyon istendi"
        }
      },
      dashboard: {
        jobPageSize: 24,
        briefMinLength: 12,
        revisionMinLength: 6,
        revisionLimit: 3,
        requestTimeoutMs: 15000,
        mobileBreakpoint: 640
      },
      admin: { pageSize: 25, mobileBreakpoint: 1120 },
      lead: { minSubmitSeconds: 3 }
    },
    ...runtimeConfig
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

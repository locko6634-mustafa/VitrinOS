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
    sentryDsn: "",
    observabilitySampleRate: 1,
    release: "vitrinos-web@0.1.0",
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

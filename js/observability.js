(function () {
  window.VitrinOS = window.VitrinOS || {};
  const config = window.VitrinOS.config || {};
  const storageKey = "vitrinos.correlation_id";

  function createId() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  let correlationId = sessionStorage.getItem(storageKey);
  if (!correlationId) {
    correlationId = createId();
    sessionStorage.setItem(storageKey, correlationId);
  }

  function getCorrelationId() {
    return correlationId;
  }

  function getTraceparent() {
    return `00-${correlationId.replaceAll("-", "").padEnd(32, "0").slice(0, 32)}-${createId().replaceAll("-", "").padEnd(16, "0").slice(0, 16)}-01`;
  }

  function captureException(error, context = {}) {
    const normalized = error instanceof Error ? error : new Error(String(error));
    if (window.Sentry?.captureException) {
      window.Sentry.captureException(normalized, { extra: { correlationId, ...context } });
    }
    console.error("VitrinOS hata", { error: normalized, correlationId, ...context });
  }

  if (config.sentryDsn && !window.Sentry) {
    const script = document.createElement("script");
    script.src = config.external?.sentryCdnUrl || "";
    script.crossOrigin = "anonymous";
    script.onload = () => window.Sentry?.init({
      dsn: config.sentryDsn,
      sampleRate: config.observabilitySampleRate ?? 1,
      tracesSampleRate: config.observabilitySampleRate ?? 1,
      release: config.release || undefined
    });
    document.head.appendChild(script);
  }

  window.addEventListener("error", (event) => captureException(event.error || event.message, { source: "window" }));
  window.addEventListener("unhandledrejection", (event) => captureException(event.reason, { source: "promise" }));

  window.VitrinOS.observability = { captureException, getCorrelationId, getTraceparent };
})();

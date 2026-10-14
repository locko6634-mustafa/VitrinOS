// VitrinOS Gözlemlenebilirlik ve Hata Yönetimi (ESM & Shared)
import { config } from "./config.js";

const storageKey = "vitrinos.correlation_id";

function createId() {
  if (typeof crypto !== "undefined" && crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

let correlationId = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(storageKey) : null;
if (!correlationId) {
  correlationId = createId();
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(storageKey, correlationId);
  }
}

export function getCorrelationId() {
  return correlationId;
}

export function getTraceparent() {
  return `00-${correlationId.replaceAll("-", "").padEnd(32, "0").slice(0, 32)}-${createId().replaceAll("-", "").padEnd(16, "0").slice(0, 16)}-01`;
}

export function captureException(error, context = {}) {
  const normalized = error instanceof Error ? error : new Error(String(error));
  if (typeof window !== "undefined" && window.Sentry?.captureException) {
    window.Sentry.captureException(normalized, { extra: { correlationId, ...context } });
  }
  console.error("VitrinOS hata", { error: normalized, correlationId, ...context });
}

if (typeof window !== "undefined") {
  window.VitrinOS = window.VitrinOS || {};
  window.VitrinOS.observability = { captureException, getCorrelationId, getTraceparent };

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
}

export default { captureException, getCorrelationId, getTraceparent };

// VitrinOS Ana Sayfa (Landing Page) Uygulama Giriş Noktası (ESM)
import "../shared/observability.js";
import { initReveal } from "./reveal.js";
import { initHeroMotion } from "./motion.js";
import { initPipeline } from "./pipeline.js";
import { initPricing } from "./pricing.js";
import { initMobileMenu, initAnchorNavigation, initAuthNavigation } from "./navigation.js";

export function initHomeApp() {
  initReveal();
  initHeroMotion();
  initPipeline();
  initMobileMenu();
  initAnchorNavigation();
  initAuthNavigation();
  initPricing();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHomeApp, { once: true });
  } else {
    initHomeApp();
  }
}

export default initHomeApp;

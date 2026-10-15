// VitrinOS Ana Sayfa (Landing Page) Uygulama Giriş Noktası (ESM)
import "../shared/observability.js";
import { initMobileMenu, initAnchorNavigation, initAuthNavigation } from "./navigation.js";
import { initSimulator } from "./simulator.js";
import { initMotionLayer } from "./motion.js";

export function initHomeApp() {
  initMobileMenu();
  initAnchorNavigation();
  initAuthNavigation();
  initSimulator();
  initMotionLayer();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHomeApp, { once: true });
  } else {
    initHomeApp();
  }
}

export default initHomeApp;

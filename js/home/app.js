/**
 * VitrinOS Landing Page Bootstrap
 * Modern Creative Studio frontend giriş noktası
 */

import { initShowcase } from "./showcase.js";
import { initFlow } from "./flow.js";
import { initPricing } from "./pricing.js";
import { initMotion } from "./motion.js";

function bootstrap() {
  initShowcase();
  initFlow();
  initPricing();
  initMotion();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}

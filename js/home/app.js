/**
 * VitrinOS Landing Page Bootstrap
 * Modern Creative Studio frontend giriş noktası
 */

import { initShowcase } from "./showcase.js";
import { initFlow } from "./flow.js";
import { initPricing } from "./pricing.js";
import { initMotion } from "./motion.js";
import { authStore } from "../shared/auth-store.js";

async function initAuthNavigation() {
  if (typeof document === "undefined") return;

  const loginLink = document.querySelector("[data-auth-login]");
  const pilotLink = document.querySelector("[data-auth-pilot]");
  const dashboardLink = document.querySelector("[data-auth-dashboard]");
  const adminLink = document.querySelector("[data-auth-admin]");

  if (!loginLink || !dashboardLink) return;

  try {
    const user = await authStore.fetchSession();
    if (!user) return;

    loginLink.hidden = true;
    if (pilotLink) pilotLink.hidden = true;
    dashboardLink.hidden = false;
    if (adminLink) adminLink.hidden = user.role !== "admin";
  } catch {
    // Oturum yoksa varsayılan butonlar kalır
  }
}

function bootstrap() {
  initShowcase();
  initFlow();
  initPricing();
  initMotion();
  initAuthNavigation();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}

// VitrinOS Gezinme ve Menü Etkileşimleri (ESM & Home)
import { authStore } from "../shared/auth-store.js";
import { config } from "../shared/config.js";

export function initMobileMenu() {
  if (typeof document === "undefined" || typeof window === "undefined") return;

  const navToggle = document.getElementById("navToggle");
  const navShell = document.getElementById("navShell");
  const navMenu = document.getElementById("navMenu");
  const menuLinks = Array.from(navMenu?.querySelectorAll("a") || []);
  const brand = navShell?.querySelector(".brand");
  const breakpoint = config?.defaults?.marketingBreakpoint || 960;
  const mobileQuery = window.matchMedia(`(max-width: ${breakpoint}px)`);

  if (!navToggle || !navShell || !navMenu) return;

  function isOpen() {
    return navShell.classList.contains("is-open");
  }

  function syncMenuState(open, returnFocus) {
    const shouldOpen = Boolean(open && mobileQuery.matches);
    navShell.classList.toggle("is-open", shouldOpen);
    navMenu.classList.toggle("is-open", shouldOpen);
    navToggle.setAttribute("aria-expanded", String(shouldOpen));
    navToggle.setAttribute("aria-label", shouldOpen ? "Menüyü kapat" : "Menüyü aç");
    document.body.classList.toggle("menu-open", shouldOpen);

    if (mobileQuery.matches && !shouldOpen) {
      navMenu.setAttribute("inert", "");
    } else {
      navMenu.removeAttribute("inert");
    }

    if (shouldOpen) {
      window.requestAnimationFrame(() => menuLinks[0]?.focus());
    } else if (returnFocus) {
      navToggle.focus();
    }
  }

  navToggle.addEventListener("click", () => syncMenuState(!isOpen(), false));

  menuLinks.forEach((link) => {
    link.addEventListener("click", () => syncMenuState(false, false));
  });

  document.addEventListener("keydown", (event) => {
    if (!isOpen()) return;

    if (event.key === "Escape") {
      event.preventDefault();
      syncMenuState(false, true);
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = [brand, ...menuLinks, navToggle].filter(Boolean);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (isOpen() && !navShell.contains(event.target)) {
      syncMenuState(false, false);
    }
  });

  mobileQuery.addEventListener("change", () => syncMenuState(false, false));
  syncMenuState(false, false);
}

export function initAnchorNavigation() {
  if (typeof document === "undefined" || typeof window === "undefined") return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const siteHeader = document.querySelector(".site-header");
  const anchorLinks = Array.from(document.querySelectorAll('a[href^="#"]'));

  if (!anchorLinks.length) return;

  function scrollToAnchor(target, updateUrl) {
    if (!target) return;

    if (target.id === "top" || target.id === "mainContent") {
      window.scrollTo({
        top: 0,
        behavior: reducedMotion.matches ? "auto" : "smooth"
      });
      if (updateUrl && target.id === "top") {
        window.history.pushState(null, "", "#top");
      }
      return;
    }

    const headerBottom = siteHeader?.getBoundingClientRect().bottom || 0;
    const breathingRoom = 12;
    const targetTop =
      window.scrollY + target.getBoundingClientRect().top - headerBottom - breathingRoom;

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: reducedMotion.matches ? "auto" : "smooth"
    });

    if (updateUrl) {
      window.history.pushState(null, "", `#${target.id}`);
    }
  }

  anchorLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetId = link.getAttribute("href")?.slice(1);
      const target = targetId ? document.getElementById(targetId) : null;

      if (!target) return;

      event.preventDefault();
      scrollToAnchor(target, true);
    });
  });
}

export async function initAuthNavigation() {
  if (typeof document === "undefined") return;

  const guestNodes = Array.from(document.querySelectorAll("[data-guest-only], [data-auth-login], [data-auth-pilot]"));
  const authNodes = Array.from(document.querySelectorAll("[data-auth-only], [data-auth-dashboard]"));
  const adminNodes = Array.from(document.querySelectorAll("[data-admin-only], [data-auth-admin]"));
  const logoutBtn = document.querySelector("[data-logout-trigger]");

  if (!guestNodes.length && !authNodes.length) return;

  try {
    const user = await authStore.fetchSession();
    if (!user) return;

    guestNodes.forEach((el) => {
      el.hidden = true;
    });
    authNodes.forEach((el) => {
      el.hidden = false;
    });
    adminNodes.forEach((el) => {
      el.hidden = user.role !== "admin";
    });
    if (logoutBtn) {
      logoutBtn.hidden = false;
      logoutBtn.addEventListener("click", async () => {
        await authStore.logout();
        window.location.reload();
      });
    }
  } catch {
    // Oturum yoksa misafir görünümünü koru
  }
}

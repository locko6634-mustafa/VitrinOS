(function () {
  function initHeroMotion() {
    const hero = document.querySelector(".hero");

    if (!hero) {
      return;
    }

    function updateDepth() {
      const rect = hero.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, Math.abs(rect.top) / Math.max(1, rect.height)));
      document.documentElement.style.setProperty("--scroll-depth", progress.toFixed(3));
    }

    updateDepth();
    window.addEventListener("scroll", updateDepth, { passive: true });
  }

  function initMobileMenu() {
    const navToggle = document.getElementById("navToggle");
    const navShell = document.getElementById("navShell");
    const navLinks = document.querySelectorAll(".nav-links a");

    if (!navToggle || !navShell) return;

    navToggle.addEventListener("click", function () {
      const isOpen = navShell.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", isOpen);
      
      if (isOpen) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "";
      }
    });

    navLinks.forEach(link => {
      link.addEventListener("click", () => {
        navShell.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      });
    });
  }

  function init() {
    window.VitrinOS.initReveal();
    window.VitrinOS.initLeadForm();
    initHeroMotion();
    initMobileMenu();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

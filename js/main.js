(function () {
  function initHeroMotion() {
    const hero = document.querySelector(".hero");

    if (!hero || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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

  function init() {
    window.VitrinOS.initReveal();
    window.VitrinOS.initLeadForm();
    initHeroMotion();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

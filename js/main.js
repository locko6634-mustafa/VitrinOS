(function () {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function initHeroMotion() {
    const hero = document.querySelector(".hero");
    const visual = document.querySelector(".hero-visual");

    if (!hero || reducedMotion.matches) return;

    let frameRequested = false;

    function updateDepth() {
      const rect = hero.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height)));
      document.documentElement.style.setProperty("--scroll-depth", progress.toFixed(3));
      frameRequested = false;
    }

    function requestDepthUpdate() {
      if (frameRequested) return;
      frameRequested = true;
      window.requestAnimationFrame(updateDepth);
    }

    function updatePointer(event) {
      const rect = visual.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
      const y = ((event.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
      visual.style.setProperty("--pointer-x", x.toFixed(3));
      visual.style.setProperty("--pointer-y", y.toFixed(3));
    }

    function resetPointer() {
      visual.style.setProperty("--pointer-x", "0");
      visual.style.setProperty("--pointer-y", "0");
    }

    updateDepth();
    window.addEventListener("scroll", requestDepthUpdate, { passive: true });
    window.addEventListener("resize", requestDepthUpdate, { passive: true });
    visual?.addEventListener("pointermove", updatePointer, { passive: true });
    visual?.addEventListener("pointerleave", resetPointer, { passive: true });
  }

  function initPipeline() {
    const story = document.querySelector("[data-pipeline]");
    const steps = Array.from(document.querySelectorAll("[data-pipeline-step]"));
    const stage = document.querySelector("[data-pipeline-stage]");
    const stagePanels = Array.from(document.querySelectorAll("[data-stage]"));
    const stageCount = document.querySelector("[data-stage-count]");

    if (!story || !steps.length || !stage) return;

    function activate(index) {
      const safeIndex = Math.min(steps.length - 1, Math.max(0, Number(index) || 0));

      steps.forEach((step, stepIndex) => {
        step.classList.toggle("is-current", stepIndex === safeIndex);
      });

      stage.dataset.activeStage = String(safeIndex);
      stagePanels.forEach((panel, panelIndex) => {
        panel.classList.toggle("is-active", panelIndex === safeIndex);
      });

      if (stageCount) {
        stageCount.textContent = String(safeIndex + 1).padStart(2, "0");
      }
    }

    activate(0);

    if (!("IntersectionObserver" in window) || reducedMotion.matches) return;

    story.classList.add("is-enhanced");
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (!visible.length) return;
        activate(visible[0].target.dataset.pipelineStep);
      },
      {
        rootMargin: "-30% 0px -48% 0px",
        threshold: [0, 0.2, 0.55]
      }
    );

    steps.forEach((step) => observer.observe(step));
  }

  function initMobileMenu() {
    const navToggle = document.getElementById("navToggle");
    const navShell = document.getElementById("navShell");
    const navMenu = document.getElementById("navMenu");
    const menuLinks = Array.from(navMenu?.querySelectorAll("a") || []);
    const brand = navShell?.querySelector(".brand");
    const mobileQuery = window.matchMedia("(max-width: 960px)");

    if (!navToggle || !navShell || !navMenu) return;

    function isOpen() {
      return navShell.classList.contains("is-open");
    }

    function syncMenuState(open, returnFocus) {
      const shouldOpen = Boolean(open && mobileQuery.matches);
      navShell.classList.toggle("is-open", shouldOpen);
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

  function init() {
    window.VitrinOS?.initReveal?.();
    window.VitrinOS?.initLeadForm?.();
    initHeroMotion();
    initPipeline();
    initMobileMenu();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

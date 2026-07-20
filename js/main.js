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
    const siteHeader = document.querySelector(".site-header");

    if (!story || !steps.length || !stage) return;

    function syncStickyOffset() {
      if (!siteHeader) return;

      const headerBottom = siteHeader.getBoundingClientRect().bottom;
      const breathingRoom = Math.max(12, Math.min(24, window.innerHeight * 0.02));
      document.documentElement.style.setProperty(
        "--pipeline-sticky-top",
        `${Math.ceil(headerBottom + breathingRoom)}px`
      );
    }

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
    syncStickyOffset();
    window.addEventListener("resize", syncStickyOffset, { passive: true });

    if (siteHeader && "ResizeObserver" in window) {
      const headerObserver = new ResizeObserver(syncStickyOffset);
      headerObserver.observe(siteHeader);
    }

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

  function initAnchorNavigation() {
    const siteHeader = document.querySelector(".site-header");
    const anchorLinks = Array.from(document.querySelectorAll('a[href^="#"]'));

    if (!anchorLinks.length) return;

    function scrollToAnchor(target, updateUrl) {
      if (!target) return;

      if (target.id === "top" || target.id === "main") {
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
      const targetStyles = window.getComputedStyle(target);
      const targetPaddingTop = parseFloat(targetStyles.paddingTop) || 0;
      const breathingRoom = 12;
      const targetTop =
        window.scrollY +
        target.getBoundingClientRect().top +
        targetPaddingTop -
        headerBottom -
        breathingRoom;

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

  async function initAuthNavigation() {
    const loginLink = document.querySelector("[data-auth-login]");
    const pilotLink = document.querySelector("[data-auth-pilot]");
    const dashboardLink = document.querySelector("[data-auth-dashboard]");
    const adminLink = document.querySelector("[data-auth-admin]");

    if (!loginLink || !pilotLink || !dashboardLink || !adminLink || !window.VitrinOS?.auth) return;

    try {
      const context = await window.VitrinOS.auth.getCurrentUser();
      if (!context || !window.VitrinOS.auth.hasRememberedLogin(context.user)) return;

      loginLink.hidden = true;
      pilotLink.hidden = true;
      dashboardLink.hidden = false;
      adminLink.hidden = context.role !== "admin";
    } catch (error) {
      console.warn("Ana sayfa oturum durumu alınamadı.", error);
    }
  }

  function initPricing() {
    const toggle = document.getElementById("billingToggle");
    const labelMonthly = document.getElementById("label-monthly");
    const labelYearly = document.getElementById("label-yearly");
    const priceValues = document.querySelectorAll(".price-value");
    const yearlyHints = document.querySelectorAll("[data-billing-yearly]");
    const monthlyHints = document.querySelectorAll("[data-billing-monthly]");

    if (!toggle || !priceValues.length) return;

    toggle.addEventListener("click", () => {
      const isYearly = toggle.getAttribute("aria-checked") === "true";
      const nextState = !isYearly;

      toggle.setAttribute("aria-checked", String(nextState));
      labelMonthly.classList.toggle("active", !nextState);
      labelYearly.classList.toggle("active", nextState);

      priceValues.forEach((el) => {
        el.style.transition = "opacity 120ms ease, transform 120ms ease";
        el.style.opacity = "0";
        el.style.transform = "translateY(-4px)";
        
        setTimeout(() => {
          const newVal = nextState ? el.dataset.yearly : el.dataset.monthly;
          el.textContent = newVal;
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
        }, 120);
      });

      yearlyHints.forEach(hint => hint.hidden = !nextState);
      monthlyHints.forEach(hint => hint.hidden = nextState);
    });
  }

  function init() {
    window.VitrinOS?.initReveal?.();
    window.VitrinOS?.initLeadForm?.();
    initHeroMotion();
    initPipeline();
    initMobileMenu();
    initAnchorNavigation();
    initAuthNavigation();
    initPricing();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

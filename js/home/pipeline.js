// VitrinOS Üretim Hattı Storyboard Etkileşimi (ESM & Home)
export function initPipeline() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
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

export default initPipeline;

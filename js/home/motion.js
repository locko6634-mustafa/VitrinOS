// VitrinOS Hero Motion & Depth Efektleri (ESM & Home)
export function initHeroMotion() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const hero = document.querySelector(".hero-section") || document.querySelector(".hero");
  const visual = document.getElementById("heroConverter") || document.querySelector(".hero-visual");

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
    if (!visual) return;
    const rect = visual.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
    const y = ((event.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
    visual.style.setProperty("--pointer-x", x.toFixed(3));
    visual.style.setProperty("--pointer-y", y.toFixed(3));
  }

  function resetPointer() {
    if (!visual) return;
    visual.style.setProperty("--pointer-x", "0");
    visual.style.setProperty("--pointer-y", "0");
  }

  updateDepth();
  window.addEventListener("scroll", requestDepthUpdate, { passive: true });
  window.addEventListener("resize", requestDepthUpdate, { passive: true });
  visual?.addEventListener("pointermove", updatePointer, { passive: true });
  visual?.addEventListener("pointerleave", resetPointer, { passive: true });
}

export default initHeroMotion;

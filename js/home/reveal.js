// VitrinOS Scroll Reveal Efekti (ESM & Home)
let initialized = false;

function showAll(items) {
  items.forEach((item) => item.classList.add("is-visible"));
}

export function initReveal() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.add("has-js");

  if (initialized) return;
  initialized = true;

  const revealItems = Array.from(document.querySelectorAll("[data-reveal]"));
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reducedMotion || !("IntersectionObserver" in window)) {
    showAll(revealItems);
    document.documentElement.classList.add("reveal-ready");
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      rootMargin: "0px 0px -9% 0px",
      threshold: 0.12
    }
  );

  revealItems.forEach((item) => observer.observe(item));
  document.documentElement.classList.add("reveal-ready");
}

if (typeof window !== "undefined") {
  window.VitrinOS = window.VitrinOS || {};
  window.VitrinOS.initReveal = initReveal;
}

export default initReveal;

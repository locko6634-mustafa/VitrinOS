(function () {
  window.VitrinOS = window.VitrinOS || {};
  document.documentElement.classList.add("has-js");

  let initialized = false;

  function showAll(items) {
    items.forEach((item) => item.classList.add("is-visible"));
  }

  function initReveal() {
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

  window.VitrinOS.initReveal = initReveal;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initReveal, { once: true });
  } else {
    initReveal();
  }
})();

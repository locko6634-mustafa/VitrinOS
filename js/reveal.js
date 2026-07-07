(function () {
  window.VitrinOS = window.VitrinOS || {};

  function initReveal() {
    const revealItems = document.querySelectorAll("[data-reveal]");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      revealItems.forEach((item) => item.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16 }
    );

    revealItems.forEach((item) => observer.observe(item));
  }

  window.VitrinOS.initReveal = initReveal;
})();

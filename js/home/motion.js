// VitrinOS — Motion Layer (Staggered Entrance & Interactive Feedback)

export function initMotionLayer() {
  if (typeof document === "undefined" || typeof window === "undefined") return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) return;

  // Staggered section entrance
  const animatedElements = Array.from(document.querySelectorAll(
    ".hero-title, .hero-statement, .hero-cta-group, .hero-stage, " +
    ".gallery-showcase, .simulator-console, .step-card, .menu-item, .faq-row, .closing-content"
  ));

  animatedElements.forEach((el, index) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    el.style.transition = `opacity 0.4s ease ${index % 4 * 0.05}s, transform 0.4s ease ${index % 4 * 0.05}s`;
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "none";
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.05,
    rootMargin: "0px 0px 50px 0px"
  });

  animatedElements.forEach(el => observer.observe(el));
}

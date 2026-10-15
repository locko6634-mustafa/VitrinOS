/**
 * VitrinOS — Modern Motion Controller
 * Scroll esnasında zarif giriş animasyonu (gentleRise), yapışkan başlık
 * durumu ve mobil menü etkileşimlerini yönetir.
 */

export function initMotion() {
  const revealElements = document.querySelectorAll("[data-reveal]");

  if (revealElements.length && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-entering");
          obs.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: "80px 0px 80px 0px",
      threshold: 0.05
    });

    revealElements.forEach(el => observer.observe(el));
  }

  // 2. Header Scroll Durumu
  const header = document.querySelector(".site-header");
  if (header) {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        header.classList.add("is-scrolled");
      } else {
        header.classList.remove("is-scrolled");
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
  }

  // 3. Mobil Menü Toggle
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      const isExpanded = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", !isExpanded);
      navLinks.classList.toggle("is-open", !isExpanded);
    });
  }
}

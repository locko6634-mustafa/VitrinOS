/**
 * VitrinOS — Sadeleştirilmiş Etkileşim Motoru (Wireframe / İskelet Modu)
 * Yalnızca işlevsel davranışlar korunur:
 * 1. Tüm [data-reveal] elemanlarının baştan görünür yapılması
 * 2. Header scroll durumu & bölüm scroll-spy
 * 3. #neden-vitrinos karşılaştırma arenası sekme geçişi
 */

export function initMotion() {
  initRevealImmediate();
  initHeaderScrollAndSpy();
  initRealityDuelArena();
}

/**
 * 1. Tüm [data-reveal] elemanlarını animasyonsuz olarak hemen görünür yap
 */
function initRevealImmediate() {
  const revealElements = document.querySelectorAll("[data-reveal]");
  revealElements.forEach((el) => el.classList.add("is-visible"));
}

/**
 * 2. Header Scroll Durumu & Bölüm Scroll-Spy
 */
function initHeaderScrollAndSpy() {
  const header = document.querySelector(".site-header");
  const scrollBar = document.getElementById("headerScrollBar");
  const navLinks = document.querySelectorAll(".nav-link[data-nav-section]");

  let ticking = false;

  const handleScroll = () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const scrollY = window.scrollY || window.pageYOffset || 0;
        if (header) {
          header.classList.toggle("is-scrolled", scrollY > 20);
        }

        if (scrollBar) {
          const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
          const progress = totalHeight > 0 ? (scrollY / totalHeight) * 100 : 0;
          scrollBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
        }
        ticking = false;
      });
      ticking = true;
    }
  };

  window.addEventListener("scroll", handleScroll, { passive: true });
  handleScroll();

  if (navLinks.length && "IntersectionObserver" in window) {
    const sections = ["vitrin", "nasil-calisir", "neden-vitrinos", "paketler"]
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    const spyObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const activeId = entry.target.id;
            navLinks.forEach((link) => {
              link.classList.toggle("is-active", link.dataset.navSection === activeId);
            });
          }
        });
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: 0 }
    );

    sections.forEach((sec) => spyObserver.observe(sec));
  }
}

/**
 * 3. Kaos vs. Disiplin Karşılaştırma Arenası Odak Kontrolü
 */
function initRealityDuelArena() {
  const modeBtns = document.querySelectorAll("[data-duel-focus]");
  const arena = document.getElementById("comparisonArena");
  if (!modeBtns.length || !arena) return;

  modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.duelFocus;
      modeBtns.forEach((b) => b.classList.toggle("is-active", b === btn));
      arena.dataset.duelState = mode;
    });
  });
}

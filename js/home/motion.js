/**
 * VitrinOS — Hareket ve Etkileşim Denetleyicisi
 * 1. Hero settle açılış animasyonu (reduced-motion uyumlu)
 * 2. Görünüm dışı duraklayan Marquee gözlemcisi
 * 3. Sticky Header daralma (is-scrolled), mobil çekmece & bölüm scroll-spy
 * 4. Progressive [data-reveal] görünürlük gözlemcisi (vo-motion-ready güvenlik ağı ile)
 */

export function initMotion() {
  initHeroSettle();
  initRevealObserver();
  initMarqueeObserver();
  initHeaderScrollAndSpy();
  initMobileNavDrawer();
}

/**
 * 1. Hero settle ölçekleme yerleşimi
 */
function initHeroSettle() {
  const heroFrame = document.querySelector("[data-hero-frame]");
  if (!heroFrame) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    heroFrame.classList.add("is-settled");
    return;
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      heroFrame.classList.add("is-settled");
    });
  });
}

/**
 * 2. Progressive [data-reveal] (vo-motion-ready güvenlik ağı ile)
 */
function initRevealObserver() {
  const revealElements = Array.from(document.querySelectorAll("[data-reveal]"));
  if (!revealElements.length) {
    document.documentElement.classList.add("vo-motion-ready");
    return;
  }

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !("IntersectionObserver" in window)) {
    revealElements.forEach((el) => el.classList.add("is-visible"));
    document.documentElement.classList.add("vo-motion-ready");
    return;
  }

  const viewportBottom = window.innerHeight || 900;
  const pending = [];

  revealElements.forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.top <= viewportBottom * 0.98) {
      el.classList.add("is-visible");
    } else {
      pending.push(el);
    }
  });

  document.documentElement.classList.add("vo-motion-ready");

  if (!pending.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -4% 0px", threshold: 0.01 }
  );

  pending.forEach((el) => observer.observe(el));

  // Hızlı kaydırmada atlanan veya görünüm yukarısında kalan ögeler için pasif güvenlik ağı
  const revealPassedElements = () => {
    const vh = window.innerHeight || 900;
    let remaining = 0;
    pending.forEach((el) => {
      if (el.classList.contains("is-visible")) return;
      const rect = el.getBoundingClientRect();
      if (rect.top <= vh * 0.96) {
        el.classList.add("is-visible");
        observer.unobserve(el);
      } else {
        remaining += 1;
      }
    });
    if (remaining === 0) {
      window.removeEventListener("scroll", revealPassedElements);
    }
  };

  window.addEventListener("scroll", revealPassedElements, { passive: true });
}

/**
 * 3. Marquee şeridini görünüm dışındayken duraklat
 */
function initMarqueeObserver() {
  const bands = document.querySelectorAll("[data-marquee-band]");
  if (!bands.length || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("is-paused", !entry.isIntersecting);
      });
    },
    { threshold: 0 }
  );

  bands.forEach((band) => observer.observe(band));
}

/**
 * 4. Header Scroll Durumu & Bölüm Scroll-Spy
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
          header.classList.toggle("is-scrolled", scrollY > 40);
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
    const phaseIdMap = ["vitrin", "nasil-calisir", "neden-vitrinos"];
    const sections = [
      ...phaseIdMap.map((id) => document.getElementById(id)).filter(Boolean),
      ...document.querySelectorAll("[data-phase-stage]"),
      document.getElementById("paketler")
    ].filter(Boolean);

    const spyObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const phaseIdx = entry.target.dataset.phaseStage;
            const activeId = phaseIdx !== undefined ? phaseIdMap[Number(phaseIdx)] : entry.target.id;
            if (!activeId) return;
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
 * 5. Mobil Navigasyon Çekmecesi (#navMenu)
 */
function initMobileNavDrawer() {
  const btn = document.querySelector("[data-mobile-nav-btn]");
  const drawer = document.getElementById("navMenu");
  if (!btn || !drawer) return;

  const setOpen = (open) => {
    drawer.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  };

  btn.addEventListener("click", () => {
    const next = !drawer.classList.contains("is-open");
    setOpen(next);
  });

  drawer.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && drawer.classList.contains("is-open")) {
      setOpen(false);
      btn.focus();
    }
  });
}

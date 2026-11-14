/**
 * VitrinOS — Scroll & Etkileşim Motoru
 * 1. IntersectionObserver tabanlı Blur + Translate + Opacity reveal
 * 2. Header scroll durumu, ~280px sonrası cam efektli Sticky Pill Navbar & scroll-spy
 * 3. #nasil-calisir 3 adımlı pinlenmiş scroll sahnesi senkronizasyonu
 * 4. #vitrin yatay karusel prev/next, sürükleme ve filtre kaydırma desteği
 * 5. #neden-vitrinos karşılaştırma arenası sekme geçişi
 */

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function initMotion() {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(REDUCED_MOTION_QUERY).matches;

  initRevealObserver(prefersReducedMotion);
  initHeaderScrollAndSpy();
  initPinnedFlowScroll(prefersReducedMotion);
  initShowcaseCarousel(prefersReducedMotion);
  initRealityDuelArena();
}

/**
 * 1. Blur + Translate + Opacity Reveal (IntersectionObserver)
 */
function initRevealObserver(prefersReducedMotion) {
  const revealElements = Array.from(document.querySelectorAll("[data-reveal]"));
  if (!revealElements.length) return;

  const showElement = (el) => {
    const delay = parseInt(el.dataset.revealDelay || "0", 10);
    if (!prefersReducedMotion && delay > 0) {
      el.style.transitionDelay = `${delay}ms`;
    }
    el.classList.add("is-visible");
  };

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealElements.forEach(showElement);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          showElement(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.08,
      rootMargin: "0px 0px -36px 0px"
    }
  );

  const viewportH = window.innerHeight || 900;
  revealElements.forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.top < viewportH * 0.95) {
      showElement(el);
    } else {
      observer.observe(el);
    }
  });
}

/**
 * 2. Header Scroll Durumu (~280px Sticky Pill Navbar) & Bölüm Scroll-Spy
 */
function initHeaderScrollAndSpy() {
  const header = document.querySelector(".site-header");
  const scrollBar = document.getElementById("headerScrollBar");
  const navLinks = document.querySelectorAll(".nav-link[data-nav-section]");

  let ticking = false;

  const updateHeader = () => {
    const scrollY = window.scrollY || window.pageYOffset || 0;
    if (header) {
      header.classList.toggle("is-scrolled", scrollY > 20);
      header.classList.toggle("is-pill", scrollY > 280);
    }

    if (scrollBar) {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = totalHeight > 0 ? (scrollY / totalHeight) * 100 : 0;
      scrollBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }
    ticking = false;
  };

  const onScroll = () => {
    if (!ticking) {
      requestAnimationFrame(updateHeader);
      ticking = true;
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  updateHeader();

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
      { rootMargin: "-28% 0px -55% 0px", threshold: 0 }
    );

    sections.forEach((sec) => spyObserver.observe(sec));
  }
}

/**
 * 3. 3 Adımlı Pinlenmiş Scroll Sahnesi (#nasil-calisir)
 * Masaüstünde (> 900px) scroll ilerlemesine göre dwell eşiklerinde adım değiştirir;
 * mevcut flow.js tıklama ve otomatik oynatma davranışını korur.
 */
function initPinnedFlowScroll(prefersReducedMotion) {
  const track = document.getElementById("flowPinnedTrack");
  const stepButtons = Array.from(document.querySelectorAll("[data-flow-step]"));
  if (!track || !stepButtons.length || prefersReducedMotion) return;

  let lastScrollStep = -1;
  let ticking = false;

  stepButtons.forEach((btn, idx) => {
    btn.addEventListener("click", (event) => {
      if (event.isTrusted) {
        lastScrollStep = idx;
      }
    });
  });

  const syncStepFromScroll = () => {
    ticking = false;
    if (window.innerWidth <= 900) return;

    const rect = track.getBoundingClientRect();
    const scrollable = track.offsetHeight - window.innerHeight;
    if (scrollable <= 40) return;

    const scrolled = -rect.top;
    if (scrolled < 0 || scrolled > scrollable) {
      lastScrollStep = -1;
      return;
    }

    const progress = scrolled / scrollable;
    const targetStep = progress < 0.34 ? 0 : progress < 0.67 ? 1 : 2;

    if (targetStep !== lastScrollStep) {
      lastScrollStep = targetStep;
      const targetBtn = stepButtons[targetStep];
      if (targetBtn && !targetBtn.classList.contains("is-active")) {
        targetBtn.click();
      }
    }
  };

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        requestAnimationFrame(syncStepFromScroll);
        ticking = true;
      }
    },
    { passive: true }
  );
}

/**
 * 4. Yatay Karusel (#mosaicGrid): Prev/Next, Fare Sürükleme & Filtre Odaklama
 */
function initShowcaseCarousel(prefersReducedMotion) {
  const grid = document.getElementById("mosaicGrid");
  const prevBtn = document.querySelector("[data-carousel-prev]");
  const nextBtn = document.querySelector("[data-carousel-next]");
  const trackFill = document.getElementById("carouselTrackFill");
  const filterBtns = document.querySelectorAll("[data-mosaic-filter]");

  if (!grid) return;

  const scrollBehavior = prefersReducedMotion ? "auto" : "smooth";

  const updateControls = () => {
    const maxScroll = Math.max(0, grid.scrollWidth - grid.clientWidth);
    const current = grid.scrollLeft;

    if (prevBtn) prevBtn.disabled = current <= 4;
    if (nextBtn) nextBtn.disabled = current >= maxScroll - 4 || maxScroll <= 4;

    if (trackFill) {
      if (maxScroll <= 0) {
        trackFill.style.width = "100%";
      } else {
        const visibleRatio = grid.clientWidth / grid.scrollWidth;
        const progressRatio = current / maxScroll;
        const widthPct = Math.min(100, Math.max(20, (visibleRatio + (1 - visibleRatio) * progressRatio) * 100));
        trackFill.style.width = `${widthPct}%`;
      }
    }
  };

  const getStepSize = () => {
    const firstCard = grid.querySelector(".mosaic-card");
    const cardWidth = firstCard ? firstCard.getBoundingClientRect().width : 340;
    return Math.min(grid.clientWidth * 0.85, cardWidth + 18);
  };

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      grid.scrollBy({ left: -getStepSize(), behavior: scrollBehavior });
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      grid.scrollBy({ left: getStepSize(), behavior: scrollBehavior });
    });
  }

  // Fare ile sürükleyerek kaydırma desteği
  let isPointerDown = false;
  let startX = 0;
  let startScrollLeft = 0;
  let didDrag = false;

  grid.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    isPointerDown = true;
    didDrag = false;
    startX = e.clientX;
    startScrollLeft = grid.scrollLeft;
    grid.classList.add("is-dragging");
  });

  window.addEventListener("pointermove", (e) => {
    if (!isPointerDown) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) didDrag = true;
    grid.scrollLeft = startScrollLeft - dx;
  });

  const endDrag = () => {
    if (!isPointerDown) return;
    isPointerDown = false;
    grid.classList.remove("is-dragging");
  };

  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  grid.addEventListener(
    "click",
    (e) => {
      if (didDrag) {
        e.preventDefault();
        didDrag = false;
      }
    },
    true
  );

  // Format filtresi seçildiğinde ilgili kartı görünür alana kaydır
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.mosaicFilter;
      if (!target || target === "all") {
        grid.scrollTo({ left: 0, behavior: scrollBehavior });
        return;
      }
      const card = grid.querySelector(`.mosaic-card[data-format-cat="${target}"]`);
      if (card) {
        const left = Math.max(0, card.offsetLeft - 8);
        grid.scrollTo({ left, behavior: scrollBehavior });
      }
    });
  });

  grid.addEventListener("scroll", updateControls, { passive: true });
  window.addEventListener("resize", updateControls, { passive: true });
  updateControls();
}

/**
 * 5. Kaos vs. Disiplin Karşılaştırma Arenası Odak Kontrolü
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

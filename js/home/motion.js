/**
 * VitrinOS — Awwwards Seviyesi Spatial Motion & Etkileşim Motoru
 * Performans Odaklı: 60 FPS Sıfır Kasıntı (Zero Jank), Özel Mouse İmleci Yok
 * 1. FOUT & Layout Shift Önleyici Preloader
 * 2. Donanım İvmeli Akıcı Scroll Reveal Sistemi (IntersectionObserver)
 * 3. Header Scroll Durumu, Lazer İlerleme Çubuğu & Bölüm Scroll-Spy
 * 4. Kartlara Fareye Duyarlı 3D Tilt ve Dinamik Spotlight (RAF Senkronize)
 * 5. Butonlara Manyetik Çekim Fiziği (Magnetic Hover Pull)
 * 6. Hero Çok Katmanlı Paralaks Derinliği (Multi-plane Parallax)
 * 7. Kaos vs. Disiplin Karşılaştırma Arenası Odak Kontrolü
 * 8. İnteraktif Takımyıldız & Parçacık Zemin Motoru (Canvas)
 */

export function initMotion() {
  initPreloader();
  initScrollReveal();
  initHeaderScrollAndSpy();
  initRealityDuelArena();
  initAmbientParticles();

  const isFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (isFinePointer && !prefersReducedMotion) {
    init3DTiltAndSpotlight();
    initMagneticButtons();
    initHeroParallax();
  }
}

/**
 * 1. Preloader (Yükleme Ekranı)
 */
function initPreloader() {
  const preloader = document.getElementById("sitePreloader");
  const heroReveals = document.querySelectorAll(".hero-section [data-reveal]");

  if (!preloader) {
    heroReveals.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const startTime = Date.now();
  const MIN_DISPLAY_TIME = 240;
  const MAX_FALLBACK_TIME = 1100;
  let dismissed = false;

  function dismiss() {
    if (dismissed) return;
    dismissed = true;

    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, MIN_DISPLAY_TIME - elapsed);

    setTimeout(() => {
      preloader.classList.add("is-loaded");

      setTimeout(() => {
        heroReveals.forEach((el) => el.classList.add("is-visible"));
      }, 80);

      setTimeout(() => {
        preloader.hidden = true;
      }, 560);
    }, remaining);
  }

  const fontPromise = document.fonts ? document.fonts.ready : Promise.resolve();
  const loadPromise = new Promise((resolve) => {
    if (document.readyState === "complete") {
      resolve();
    } else {
      window.addEventListener("load", resolve, { once: true });
    }
  });

  Promise.all([fontPromise, loadPromise]).then(dismiss);
  setTimeout(dismiss, MAX_FALLBACK_TIME);
}

/**
 * 2. Kademeli Scroll Reveal (IntersectionObserver)
 */
function initScrollReveal() {
  const scrollElements = document.querySelectorAll(
    "main > section:not(.hero-section) [data-reveal], footer [data-reveal]"
  );
  if (!scrollElements.length) return;

  if (!("IntersectionObserver" in window)) {
    scrollElements.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    },
    {
      rootMargin: "0px 0px -32px 0px",
      threshold: 0.08,
    }
  );

  scrollElements.forEach((el) => observer.observe(el));
}

/**
 * 3. Header Scroll Durumu, Lazer İlerleme Çubuğu & Bölüm Scroll-Spy
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
 * 4. Kartlara Fareye Duyarlı 3D Tilt ve Dinamik Spotlight (RAF Senkronize)
 */
function init3DTiltAndSpotlight() {
  const tiltSelectors = [
    "[data-tilt-card]",
    ".stage-card",
    ".mosaic-card",
    ".flow-visual-card",
    ".comparison-box",
    ".price-card",
    ".footer-portal-card",
  ];
  const cards = document.querySelectorAll(tiltSelectors.join(", "));
  if (!cards.length) return;

  cards.forEach((card) => {
    let bounds = null;
    let isHovered = false;
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;
    let targetPctX = "50%";
    let targetPctY = "50%";
    let rafId = null;

    const maxTilt = card.classList.contains("footer-portal-card") ? 3.5 : 6.5;

    function updateBounds() {
      bounds = card.getBoundingClientRect();
    }

    function onMouseEnter() {
      isHovered = true;
      updateBounds();
      card.style.setProperty("--spotlight-opacity", "1");
      if (!rafId) {
        rafId = requestAnimationFrame(render);
      }
    }

    function onMouseMove(e) {
      if (!bounds) updateBounds();
      const mouseX = e.clientX - bounds.left;
      const mouseY = e.clientY - bounds.top;

      targetPctX = `${((mouseX / bounds.width) * 100).toFixed(1)}%`;
      targetPctY = `${((mouseY / bounds.height) * 100).toFixed(1)}%`;

      const normX = (mouseX / bounds.width - 0.5) * 2;
      const normY = (mouseY / bounds.height - 0.5) * 2;
      targetX = -normY * maxTilt;
      targetY = normX * maxTilt;
    }

    function onMouseLeave() {
      isHovered = false;
      targetX = 0;
      targetY = 0;
      card.style.setProperty("--spotlight-opacity", "0");
    }

    function render() {
      currentX += (targetX - currentX) * 0.14;
      currentY += (targetY - currentY) * 0.14;

      if (isHovered) {
        card.style.setProperty("--mouse-x", targetPctX);
        card.style.setProperty("--mouse-y", targetPctY);
      }

      if (isHovered || Math.abs(currentX) > 0.05 || Math.abs(currentY) > 0.05) {
        card.style.transform = `perspective(1100px) rotateX(${currentX.toFixed(2)}deg) rotateY(${currentY.toFixed(2)}deg) scale3d(1.008, 1.008, 1.008)`;
        rafId = requestAnimationFrame(render);
      } else {
        card.style.transform = "";
        rafId = null;
      }
    }

    card.addEventListener("mouseenter", onMouseEnter, { passive: true });
    card.addEventListener("mousemove", onMouseMove, { passive: true });
    card.addEventListener("mouseleave", onMouseLeave, { passive: true });
  });
}

/**
 * 5. Butonlara Manyetik Çekim Fiziği
 */
function initMagneticButtons() {
  const magneticSelectors = [
    ".btn-primary",
    ".btn-secondary",
    ".whatsapp-float",
    ".scenario-btn",
    ".btn-nav-login",
    ".xray-toggle-btn",
  ];
  const buttons = document.querySelectorAll(magneticSelectors.join(", "));
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    let bounds = null;
    let isHovered = false;
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;
    let rafId = null;

    const pullStrength = btn.classList.contains("whatsapp-float") ? 0.22 : 0.28;
    const maxPull = 9;

    function updateBounds() {
      bounds = btn.getBoundingClientRect();
    }

    function onMouseEnter() {
      isHovered = true;
      updateBounds();
      if (!rafId) {
        rafId = requestAnimationFrame(render);
      }
    }

    function onMouseMove(e) {
      if (!bounds) updateBounds();
      const relX = e.clientX - (bounds.left + bounds.width / 2);
      const relY = e.clientY - (bounds.top + bounds.height / 2);

      targetX = Math.max(-maxPull, Math.min(maxPull, relX * pullStrength));
      targetY = Math.max(-maxPull, Math.min(maxPull, relY * pullStrength));
    }

    function onMouseLeave() {
      isHovered = false;
      targetX = 0;
      targetY = 0;
    }

    function render() {
      currentX += (targetX - currentX) * 0.16;
      currentY += (targetY - currentY) * 0.16;

      if (isHovered || Math.abs(currentX) > 0.1 || Math.abs(currentY) > 0.1) {
        btn.style.transform = `translate3d(${currentX.toFixed(1)}px, ${currentY.toFixed(1)}px, 0)`;

        const child = btn.querySelector("span, .btn-icon, .whatsapp-icon-circle");
        if (child) {
          child.style.transform = `translate3d(${(currentX * 0.22).toFixed(1)}px, ${(currentY * 0.22).toFixed(1)}px, 0)`;
        }
        rafId = requestAnimationFrame(render);
      } else {
        btn.style.transform = "";
        const child = btn.querySelector("span, .btn-icon, .whatsapp-icon-circle");
        if (child) child.style.transform = "";
        rafId = null;
      }
    }

    btn.addEventListener("mouseenter", onMouseEnter, { passive: true });
    btn.addEventListener("mousemove", onMouseMove, { passive: true });
    btn.addEventListener("mouseleave", onMouseLeave, { passive: true });
  });
}

/**
 * 6. Hero Çok Katmanlı Paralaks Derinliği
 */
function initHeroParallax() {
  const heroSection = document.querySelector(".hero-section");
  const heroStatement = document.querySelector(".hero-statement");
  const heroStage = document.querySelector(".hero-stage-wrapper");
  const heroHud = document.querySelector(".stage-rules-bar");

  if (!heroSection || !heroStatement || !heroStage) return;

  let mouseX = 0;
  let mouseY = 0;
  let currentStatementX = 0;
  let currentStatementY = 0;
  let currentStageX = 0;
  let currentStageY = 0;
  let currentHudX = 0;
  let currentHudY = 0;
  let rafId = null;

  function onMouseMove(e) {
    const { innerWidth, innerHeight } = window;
    mouseX = (e.clientX / innerWidth - 0.5) * 2;
    mouseY = (e.clientY / innerHeight - 0.5) * 2;

    if (!rafId) {
      rafId = requestAnimationFrame(render);
    }
  }

  function render() {
    const targetStatX = mouseX * -8;
    const targetStatY = mouseY * -5;
    const targetStageX = mouseX * 12;
    const targetStageY = mouseY * 8;
    const targetHudX = mouseX * -6;
    const targetHudY = mouseY * -4;

    currentStatementX += (targetStatX - currentStatementX) * 0.08;
    currentStatementY += (targetStatY - currentStatementY) * 0.08;
    currentStageX += (targetStageX - currentStageX) * 0.08;
    currentStageY += (targetStageY - currentStageY) * 0.08;
    currentHudX += (targetHudX - currentHudX) * 0.1;
    currentHudY += (targetHudY - currentHudY) * 0.1;

    heroStatement.style.transform = `translate3d(${currentStatementX.toFixed(1)}px, ${currentStatementY.toFixed(1)}px, 0)`;
    heroStage.style.transform = `translate3d(${currentStageX.toFixed(1)}px, ${currentStageY.toFixed(1)}px, 0)`;
    if (heroHud) {
      heroHud.style.transform = `translate3d(${currentHudX.toFixed(1)}px, ${currentHudY.toFixed(1)}px, 0)`;
    }

    if (
      Math.abs(targetStatX - currentStatementX) > 0.05 ||
      Math.abs(targetStatY - currentStatementY) > 0.05
    ) {
      rafId = requestAnimationFrame(render);
    } else {
      rafId = null;
    }
  }

  heroSection.addEventListener("mousemove", onMouseMove, { passive: true });
}

/**
 * 7. Kaos vs. Disiplin Karşılaştırma Arenası Odak Kontrolü
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

/**
 * 8. Ultra Optimize Takımyıldız & Parçacık Zemin Motoru (Zero shadowBlur Canvas)
 */
function initAmbientParticles() {
  let canvas = document.getElementById("ambientCanvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "ambientCanvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.prepend(canvas);
  }

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let particles = [];
  let isTabActive = true;
  let rafId = null;

  const isMobile = window.innerWidth < 768;
  const particleCount = isMobile ? 14 : 28;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  class Particle {
    constructor() {
      this.reset(true);
    }

    reset(initial = false) {
      this.x = Math.random() * width;
      this.y = initial ? Math.random() * height : height + 10;
      this.size = Math.random() * 1.9 + 0.7;
      this.speedY = Math.random() * 0.35 + 0.12;
      this.speedX = (Math.random() - 0.5) * 0.22;
      this.alpha = Math.random() * 0.38 + 0.14;
      this.pulseSpeed = Math.random() * 0.02 + 0.008;
      this.pulse = Math.random() * Math.PI;
      this.isLime = Math.random() > 0.38;
      this.color = this.isLime ? "204, 255, 0" : "43, 102, 255";
    }

    update() {
      this.y -= this.speedY;
      this.x += this.speedX;
      this.pulse += this.pulseSpeed;

      if (this.y < -20 || this.x < -20 || this.x > width + 20) {
        this.reset();
      }
    }

    draw() {
      const currentAlpha = Math.max(0.05, this.alpha + Math.sin(this.pulse) * 0.12);

      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 2.3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.color}, ${(currentAlpha * 0.22).toFixed(3)})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.color}, ${currentAlpha.toFixed(2)})`;
      ctx.fill();
    }
  }

  function init() {
    resize();
    particles = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }
  }

  function loop() {
    if (!isTabActive) return;
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw();
    }

    // Yakın parçacıklar arasında ince takımyıldız bağları
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 16000) {
          const lineAlpha = (1 - distSq / 16000) * 0.07;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(204, 255, 0, ${lineAlpha.toFixed(3)})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }

    rafId = requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize, { passive: true });

  document.addEventListener("visibilitychange", () => {
    isTabActive = !document.hidden;
    if (isTabActive) {
      if (!rafId) rafId = requestAnimationFrame(loop);
    } else if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  });

  init();
  loop();
}

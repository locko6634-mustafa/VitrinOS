/**
 * VitrinOS — Awwwards Seviyesi Motion & Etkileşim Motoru
 * 1. FOUT & Layout Shift Önleyici Preloader
 * 2. Donanım İvmeli Akıcı Scroll Reveal Sistemi (IntersectionObserver)
 * 3. Header Scroll Durumu & Neon İlerleme Çubuğu
 * 4. Kartlara Fareye Duyarlı 3D Tilt ve Dinamik Spotlight Işıltısı (LERP & Spring)
 * 5. Butonlara Manyetik Çekim Fiziği (Magnetic Hover Pull & Sub-element Depth)
 * 6. Hero Alanı Çok Katmanlı Paralaks Derinliği (Multi-plane Parallax)
 * 7. Atmosferik Işık & Parçacık Zemin Motoru (Ambient Stardust Canvas)
 *
 * NOT: Özel mouse imleci (custom cursor) KULLANILMAZ.
 * Masaüstü/Fare algılandığında (pointer: fine) zenginleştirilir; dokunmatik/mobilde pürüzsüz çalışır.
 */

export function initMotion() {
  initPreloader();
  initScrollReveal();
  initHeaderScroll();
  initAmbientParticles();

  // Yalnızca mouse ve hassas işaretçiye sahip cihazlarda 3D tilt, manyetik ve paralaks çalıştır
  const isFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (isFinePointer) {
    init3DTiltAndSpotlight();
    initMagneticButtons();
    initHeroParallax();
  }
}

/**
 * 1. Preloader (Yükleme Ekranı)
 * Fontlar ve kritik görsel varlıkları hazır olduğunda zarifçe perdeyi kaldırır.
 */
function initPreloader() {
  const preloader = document.getElementById("sitePreloader");
  const heroReveals = document.querySelectorAll(".hero-section [data-reveal]");

  if (!preloader) {
    heroReveals.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const startTime = Date.now();
  const MIN_DISPLAY_TIME = 350;
  const MAX_FALLBACK_TIME = 1400;

  function dismiss() {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, MIN_DISPLAY_TIME - elapsed);

    setTimeout(() => {
      preloader.classList.add("is-loaded");

      setTimeout(() => {
        heroReveals.forEach((el) => el.classList.add("is-visible"));
      }, 150);

      setTimeout(() => {
        preloader.hidden = true;
      }, 750);
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
 * 2. Kademeli Scroll Reveal Animasyon Sistemi
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
          entry.target.classList.add("is-entering");
          obs.unobserve(entry.target);
        }
      });
    },
    {
      rootMargin: "0px 0px -40px 0px",
      threshold: 0.1,
    }
  );

  scrollElements.forEach((el) => observer.observe(el));
}

/**
 * 3. Header Scroll Durumu & Neon İlerleme Çubuğu
 */
function initHeaderScroll() {
  const header = document.querySelector(".site-header");
  const scrollBar = document.getElementById("headerScrollBar");

  if (!header && !scrollBar) return;

  const handleScroll = () => {
    const scrollY = window.scrollY || window.pageYOffset || 0;
    if (header) {
      if (scrollY > 20) {
        header.classList.add("is-scrolled");
      } else {
        header.classList.remove("is-scrolled");
      }
    }

    if (scrollBar) {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = totalHeight > 0 ? (scrollY / totalHeight) * 100 : 0;
      scrollBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }
  };

  window.addEventListener("scroll", handleScroll, { passive: true });
  handleScroll();
}

/**
 * 4. Kartlara Fareye Duyarlı 3D Tilt ve Dinamik Spotlight Işıltısı
 * LERP sönümleme ve CSS değişkenleri ile donanım ivmeli ultra akıcı hareket.
 */
function init3DTiltAndSpotlight() {
  const tiltSelectors = [
    ".stage-card",
    ".mosaic-card",
    ".flow-visual-card",
    ".comparison-box",
    ".price-card",
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
    let rafId = null;

    const maxTilt = 8; // maksimum eğim derecesi

    function updateBounds() {
      bounds = card.getBoundingClientRect();
    }

    function onMouseEnter(e) {
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

      // Spotlight için yüzde pozisyonu
      const pctX = ((mouseX / bounds.width) * 100).toFixed(1);
      const pctY = ((mouseY / bounds.height) * 100).toFixed(1);
      card.style.setProperty("--mouse-x", `${pctX}%`);
      card.style.setProperty("--mouse-y", `${pctY}%`);

      // 3D Tilt hedef açıları
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
      // Yumuşak LERP (Lineer İnterpolasyon)
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;

      if (isHovered || Math.abs(currentX) > 0.05 || Math.abs(currentY) > 0.05) {
        card.style.transform = `perspective(1000px) rotateX(${currentX.toFixed(2)}deg) rotateY(${currentY.toFixed(2)}deg) scale3d(1.015, 1.015, 1.015)`;
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
 * 5. Butonlara Manyetik Çekim Fiziği (Magnetic Hover Pull)
 * Fare butonun üzerine geldiğinde buton ve içeriği fareye doğru elastik çekilir.
 */
function initMagneticButtons() {
  const magneticSelectors = [
    ".btn-primary",
    ".btn-secondary",
    ".whatsapp-float",
    ".scenario-btn",
    ".btn-nav-login",
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

    const pullStrength = btn.classList.contains("whatsapp-float") ? 0.25 : 0.35;
    const maxPull = 12; // Maksimum kayma pikseli

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
      currentX += (targetX - currentX) * 0.15;
      currentY += (targetY - currentY) * 0.15;

      if (isHovered || Math.abs(currentX) > 0.1 || Math.abs(currentY) > 0.1) {
        btn.style.transform = `translate3d(${currentX.toFixed(1)}px, ${currentY.toFixed(1)}px, 0)`;

        // İç elemanlara mikro paralaks
        const child = btn.querySelector("span, .btn-icon, .whatsapp-icon-circle");
        if (child) {
          child.style.transform = `translate3d(${(currentX * 0.3).toFixed(1)}px, ${(currentY * 0.3).toFixed(1)}px, 0)`;
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
 * 6. Hero Alanı Çok Katmanlı Paralaks Derinliği (Multi-plane Parallax)
 * Fare hareket ettikçe ve sayfa kaydırıldıkça hero katmanları zıt yönlerde süzülür.
 */
function initHeroParallax() {
  const heroSection = document.querySelector(".hero-section");
  const heroStatement = document.querySelector(".hero-statement");
  const heroStage = document.querySelector(".hero-stage-wrapper");

  if (!heroSection || !heroStatement || !heroStage) return;

  let mouseX = 0;
  let mouseY = 0;
  let currentStatementX = 0;
  let currentStatementY = 0;
  let currentStageX = 0;
  let currentStageY = 0;
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
    const targetStatX = mouseX * -12;
    const targetStatY = mouseY * -8;
    const targetStageX = mouseX * 16;
    const targetStageY = mouseY * 12;

    currentStatementX += (targetStatX - currentStatementX) * 0.08;
    currentStatementY += (targetStatY - currentStatementY) * 0.08;
    currentStageX += (targetStageX - currentStageX) * 0.08;
    currentStageY += (targetStageY - currentStageY) * 0.08;

    heroStatement.style.transform = `translate3d(${currentStatementX.toFixed(1)}px, ${currentStatementY.toFixed(1)}px, 0)`;
    heroStage.style.transform = `translate3d(${currentStageX.toFixed(1)}px, ${currentStageY.toFixed(1)}px, 0)`;

    if (
      Math.abs(targetStatX - currentStatementX) > 0.05 ||
      Math.abs(targetStatY - currentStatementY) > 0.05
    ) {
      rafId = requestAnimationFrame(render);
    } else {
      rafId = null;
    }
  }

  window.addEventListener("mousemove", onMouseMove, { passive: true });
}

/**
 * 7. Atmosferik Işık & Parçacık Zemin Motoru (Ambient Stardust Canvas)
 * 60 FPS çalışan, hafif, zarif neon lime ve kobalt mikro ışık zerreleri.
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
  let mouse = { x: -1000, y: -1000, radius: 180 };
  let isTabActive = true;
  let rafId = null;

  const isMobile = window.innerWidth < 768;
  const particleCount = isMobile ? 18 : 42;

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
      this.size = Math.random() * 2.2 + 0.8;
      this.baseX = this.x;
      this.baseY = this.y;
      this.speedY = Math.random() * 0.45 + 0.15;
      this.speedX = (Math.random() - 0.5) * 0.3;
      this.alpha = Math.random() * 0.45 + 0.15;
      this.pulseSpeed = Math.random() * 0.02 + 0.008;
      this.pulse = Math.random() * Math.PI;

      // Renk: %70 Neon Lime (#ccff00), %30 Kobalt Mavi (#2b66ff)
      this.isLime = Math.random() > 0.3;
      this.color = this.isLime ? "204, 255, 0" : "43, 102, 255";
    }

    update() {
      this.y -= this.speedY;
      this.x += this.speedX;
      this.pulse += this.pulseSpeed;

      // Fareye duyarlı hava akımı (itme)
      const dx = mouse.x - this.x;
      const dy = mouse.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < mouse.radius) {
        const force = (1 - dist / mouse.radius) * 1.8;
        this.x -= (dx / dist) * force;
        this.y -= (dy / dist) * force;
      }

      if (this.y < -20 || this.x < -20 || this.x > width + 20) {
        this.reset();
      }
    }

    draw() {
      const currentAlpha = Math.max(
        0.05,
        this.alpha + Math.sin(this.pulse) * 0.15
      );
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.color}, ${currentAlpha.toFixed(2)})`;
      ctx.shadowBlur = this.size * 5;
      ctx.shadowColor = `rgba(${this.color}, 0.6)`;
      ctx.fill();
      ctx.shadowBlur = 0;
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

    rafId = requestAnimationFrame(loop);
  }

  window.addEventListener("resize", () => {
    resize();
  }, { passive: true });

  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
    isTabActive = !document.hidden;
    if (isTabActive) {
      if (!rafId) rafId = requestAnimationFrame(loop);
    } else {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }
  });

  init();
  loop();
}

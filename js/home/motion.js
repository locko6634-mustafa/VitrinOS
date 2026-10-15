/**
 * VitrinOS — Modern Motion & Preloader Controller
 * 1. FOUT & Layout Shift Önleyici Preloader (Fontlar ve DOM hazır olana kadar)
 * 2. Donanım İvmeli Akıcı Scroll Reveal Sistemi (IntersectionObserver)
 * 3. Header Scroll Durumu & Canlı İlerleme Çubuğu
 * 4. Mobil Menü Toggle Etkileşimi
 */

export function initMotion() {
  initPreloader();
  initScrollReveal();
  initHeaderScroll();
  initMobileMenu();
}

/**
 * 1. Preloader (Yükleme Ekranı)
 * Fontlar ve kritik görsel varlıkları hazır olduğunda zarifçe perdeyi kaldırır.
 */
function initPreloader() {
  const preloader = document.getElementById("sitePreloader");
  if (!preloader) {
    document.body.classList.add("motion-ready");
    return;
  }

  const startTime = Date.now();
  const MIN_DISPLAY_TIME = 450; // Çok ani sıçramayı önleyen mikro bekleme
  const MAX_FALLBACK_TIME = 1500; // Herhangi bir varlık takılırsa maksimum bekleme

  function dismiss() {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, MIN_DISPLAY_TIME - elapsed);

    setTimeout(() => {
      preloader.classList.add("is-loaded");
      document.body.classList.add("motion-ready");

      // Geçiş animasyonu (700ms) bittiğinde DOM'dan tamamen gizle
      setTimeout(() => {
        preloader.hidden = true;
      }, 750);
    }, remaining);
  }

  // document.fonts API'si ve sayfa yüklemesini dinle
  const fontPromise = document.fonts ? document.fonts.ready : Promise.resolve();
  const loadPromise = new Promise(resolve => {
    if (document.readyState === "complete") {
      resolve();
    } else {
      window.addEventListener("load", resolve, { once: true });
    }
  });

  Promise.all([fontPromise, loadPromise]).then(dismiss);

  // Fallback zamanlayıcısı (sayfa asla asılı kalmasın)
  setTimeout(dismiss, MAX_FALLBACK_TIME);
}

/**
 * 2. Akıcı Scroll Reveal Animasyon Sistemi
 */
function initScrollReveal() {
  const revealElements = document.querySelectorAll("[data-reveal]");
  if (!revealElements.length) return;

  if (!("IntersectionObserver" in window)) {
    // Tarayıcı desteklemiyorsa hepsini doğrudan görünür yap
    revealElements.forEach(el => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        entry.target.classList.add("is-entering"); // geriye dönük uyumluluk
        obs.unobserve(entry.target);
      }
    });
  }, {
    rootMargin: "0px 0px -40px 0px",
    threshold: 0.1
  });

  revealElements.forEach(el => observer.observe(el));
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
 * 4. Mobil Menü Toggle
 */
function initMobileMenu() {
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

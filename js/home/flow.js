/**
 * VitrinOS — Birleşik 3-Fazlı (12 Adımlı) Pinned Kaydırma ve Stüdyo Motoru
 * - Tek birleşik [data-unified-pinned] sahnesi içinde 3 faz:
 *   Faz 0 (#vitrin): Format & Marka Mimarisi (Morflanan sahne)
 *   Faz 1 (#nasil-calisir): Otonom Üretim Hattı (#sim* stüdyo motoru)
 *   Faz 2 (#neden-vitrinos): Kontrol & Hız Karşılaştırması
 * - Masaüstünde (>= 800px): Ekrana tam ortalı sticky çerçevede IntersectionObserver + rAF ile akış
 * - Mobilde (< 800px): Scroll hijacking olmadan 3 faz dikey akış + dokunma geçişi
 * - prefers-reduced-motion: reduce tam desteği
 */

const PHASE_META = [
  {
    id: "vitrin",
    kicker: "FORMAT VE MARKA MİMARİSİ",
    titleBefore: "Her sektör ve her mecra için ",
    titleEm: "markanıza tam uyum."
  },
  {
    id: "nasil-calisir",
    kicker: "OTONOM ÜRETİM HATTI",
    titleBefore: "Ne istediğinizi söyleyin, ",
    titleEm: "markanıza özel tasarlansın."
  },
  {
    id: "neden-vitrinos",
    kicker: "KONTROL & HIZ KARŞILAŞTIRMASI",
    titleBefore: "Geleneksel ajans ile ",
    titleEm: "VitrinOS arasındaki fark."
  }
];

const SCENARIOS = [
  {
    id: "tech",
    prompt: "Yazılım ekibimiz için 'Kıdemli Frontend Geliştirici' arayışımıza özel, modern antrasit tonlarında ve elektrik mavisi vurgulu bir iş ilanı postu hazırla.",
    sector: "Yazılım & SaaS",
    format: "Post (4:5) + Story (9:16)",
    intent: "Kıdemli Yetenek İlanı",
    tone: "Modern & Minimalist",
    brandName: "Nexus Cloud Labs",
    profileId: "PROFİL: #VO-9042",
    palette: [
      { name: "Elektrik Mavi", hex: "#2b66ff" },
      { name: "Grafit Gece", hex: "#161922" },
      { name: "Saf Beyaz", hex: "#ffffff" }
    ],
    font: "Instrument Sans / IBM Plex Mono",
    logo: "Sol Üst 24px Güvenli Izgara",
    visualTone: "Teknoloji Stüdyosu & Net Hiyerarşi",
    image: "assets/sim-tech-hiring.jpg",
    formatBadge: "İş İlanı Postu 4:5",
    multiFormatLabel: "Post 4:5 · Çoklu Oran Kilidi",
    aspectRatio: "4 / 3",
    reviseExample: "Arka planı biraz daha koyult ve 'Remote' rozetini öne çıkar"
  },
  {
    id: "coffee",
    prompt: "Hafta sonu gerçekleşecek V60 Demleme ve Latte Art atölyemiz için sıcak fındık tonlarında estetik bir Instagram Story'si oluştur.",
    sector: "Butik Kafe & Gastronomi",
    format: "Story (9:16) + Post (4:5)",
    intent: "Atölye & Workshop Duyurusu",
    tone: "Sıcak, Organik & Davetkar",
    brandName: "Artisan Roastery Studio",
    profileId: "PROFİL: #VO-7183",
    palette: [
      { name: "Karamel Fındık", hex: "#d49b6a" },
      { name: "Koyu Espresso", hex: "#2a201a" },
      { name: "Doğal Krem", hex: "#faf7f2" }
    ],
    font: "Newsreader Editorial / Instrument Sans",
    logo: "Üst Sol Güvenli Alan",
    visualTone: "Editoryal Dergi Estetiği & Doğal Işık",
    image: "assets/sim-coffee-workshop.jpg",
    formatBadge: "Story 9:16",
    multiFormatLabel: "Story 9:16 · UI Boşluğu Korumalı",
    aspectRatio: "4 / 3",
    reviseExample: "Yazıyı biraz daha büyüt ve 'Sınırlı Kontenjan' etiketini ekle"
  },
  {
    id: "architecture",
    prompt: "Yeni tamamladığımız monokrom penthouse projemizin tanıtımı için galeri estetiğinde, geniş formatlı bir portfolyo lansman görseli hazırla.",
    sector: "Mimarlık & İç Mekan",
    format: "Banner (16:6) + Post (4:5)",
    intent: "Mimari Proje Lansmanı",
    tone: "Heykelsi, Sessiz Lüks & Galeri",
    brandName: "Monolith Studio Arch",
    profileId: "PROFİL: #VO-5510",
    palette: [
      { name: "Platin Beton", hex: "#e5e5e5" },
      { name: "Kömür Siyahı", hex: "#1a1a1a" },
      { name: "Traverten Bej", hex: "#d9d0c5" }
    ],
    font: "Newsreader Serif / IBM Plex Mono",
    logo: "Sağ Alt Minimalist İmza",
    visualTone: "Traverten Dokusu & Mimari Gölgeler",
    image: "assets/sim-architecture-studio.jpg",
    formatBadge: "Lansman Banner 16:9",
    multiFormatLabel: "Banner 16:6 · Negatif Alan Dengesi",
    aspectRatio: "16 / 10",
    reviseExample: "Görsel kontrastını artır ve başlığı tek satıra indir"
  }
];

const MORPH_STEPS = [
  {
    ratio: "1080 × 1080 · 1:1 AKIŞ POSTU",
    brand: "Vortex Creative · #HEX Kilitli"
  },
  {
    ratio: "1080 × 1920 · 9:16 DİKEY STORY",
    brand: "Artisan Coffee Lab · Safe-Zone"
  },
  {
    ratio: "1600 × 600 · 16:9 WEB BANNER",
    brand: "Natura Minimal · Geniş Vitrin"
  },
  {
    ratio: "TÜM ORANLARDA KURAL KALKANI",
    brand: "Stratos Cloud · Marka DNA Aktif"
  }
];

const COMPARE_STEPS = [
  {
    kicker: "KAMPANYA SETİ TESLİM SÜRESİ",
    before: "5 gün",
    after: "45 sn",
    summary: "Ajanslarda günler süren brief, taslak ve onay döngüsü yerine markanıza özel görseller saniyeler içinde yayına hazır.",
    agencyLabel: "3–5 gün bekleme",
    aiLabel: "2+ saat manuel düzeltme",
    vitrinosLabel: "45 saniyede tüm formatlar",
    agencyPct: "92%",
    aiPct: "58%",
    vitrinosPct: "16%"
  },
  {
    kicker: "KURUMSAL KİMLİK & RENK TUTARLILIĞI",
    before: "%40",
    after: "%100",
    summary: "Genel AI araçlarının rastgele renk ve logo bozulmaları olmadan her çıktı şirketinizin #HEX kurallarına kilitlenir.",
    agencyLabel: "Tasarımcıya bağlı (%75)",
    aiLabel: "Rastgele sapma (%40)",
    vitrinosLabel: "%100 Kilitli Marka DNA'sı",
    agencyPct: "75%",
    aiPct: "40%",
    vitrinosPct: "100%"
  },
  {
    kicker: "REVİZYON SÜRECİ & MALİYETİ",
    before: "Ek fatura",
    after: "Tek tık",
    summary: "Her değişiklik için yeni ajans turu veya tasarım dosyasını baştan açma zahmeti olmadan tek cümleyle anında güncelleyin.",
    agencyLabel: "Ek süre & revizyon faturası",
    aiLabel: "Baştan üretim & kırpma yükü",
    vitrinosLabel: "Tek cümleyle anında revizyon",
    agencyPct: "88%",
    aiPct: "72%",
    vitrinosPct: "18%"
  },
  {
    kicker: "KAMPANYA ÖLÇEKLEME KAPASİTESİ",
    before: "Darboğaz",
    after: "Sınırsız varyasyon",
    summary: "Kampanya dönemlerinde ekip kapasitesine takılmadan Story, Post ve Web Banner setlerini aynı kalitede çoğaltın.",
    agencyLabel: "Kampanya başına darboğaz",
    aiLabel: "Tutarsız görsel kalite yükü",
    vitrinosLabel: "Sabit planla sınırsız varyasyon",
    agencyPct: "84%",
    aiPct: "66%",
    vitrinosPct: "100%"
  }
];

function createStudioSimulator(sectionEl) {
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const presetBtns = sectionEl.querySelectorAll("[data-sim-preset]");

  const simSectorTag = document.getElementById("simSectorTag");
  const simPromptText = document.getElementById("simPromptText");
  const simMetaSector = document.getElementById("simMetaSector");
  const simMetaFormat = document.getElementById("simMetaFormat");
  const simMetaIntent = document.getElementById("simMetaIntent");
  const simMetaTone = document.getElementById("simMetaTone");

  const simProfileId = document.getElementById("simProfileId");
  const simBrandHeading = document.getElementById("simBrandHeading");
  const simPaletteSwatches = document.getElementById("simPaletteSwatches");
  const simRuleFont = document.getElementById("simRuleFont");
  const simRuleLogo = document.getElementById("simRuleLogo");
  const simRuleVisual = document.getElementById("simRuleVisual");

  const simMultiPreviewImg = document.getElementById("simMultiPreviewImg");
  const simMultiFormatLabel = document.getElementById("simMultiFormatLabel");

  const simReadyBadge = document.getElementById("simReadyBadge");
  const simArtworkFrame = document.getElementById("simArtworkFrame");
  const simArtworkImg = document.getElementById("simArtworkImg");
  const simFormatTag = document.getElementById("simFormatTag");
  const simReviseExample = document.getElementById("simReviseExample");
  const reviseBtn = sectionEl.querySelector(".sim-btn-edit");
  const dlBtn = sectionEl.querySelector(".sim-btn-dl");

  let currentScenarioIndex = 0;
  let typingTimer = null;
  let activeStepInPhase = 0;

  function renderPaletteSwatches(palette) {
    if (!simPaletteSwatches) return;
    const nodes = palette.map((item) => {
      const wrapper = document.createElement("div");
      wrapper.className = "swatch-item";

      const dot = document.createElement("span");
      dot.className = "swatch-color";
      dot.style.background = item.hex;

      const meta = document.createElement("span");
      meta.className = "swatch-meta";
      meta.textContent = `${item.name} (`;

      const code = document.createElement("code");
      code.textContent = item.hex;

      meta.append(code, ")");
      wrapper.append(dot, meta);
      return wrapper;
    });
    simPaletteSwatches.replaceChildren(...nodes);
  }

  function applyScenarioData(scenario) {
    if (simSectorTag) simSectorTag.textContent = scenario.sector;
    if (simMetaSector) simMetaSector.textContent = scenario.sector;
    if (simMetaFormat) simMetaFormat.textContent = scenario.format;
    if (simMetaIntent) simMetaIntent.textContent = scenario.intent;
    if (simMetaTone) simMetaTone.textContent = scenario.tone;

    if (simProfileId) simProfileId.textContent = scenario.profileId;
    if (simBrandHeading) simBrandHeading.textContent = `${scenario.brandName} Doğrulandı:`;
    if (simRuleFont) simRuleFont.textContent = scenario.font;
    if (simRuleLogo) simRuleLogo.textContent = scenario.logo;
    if (simRuleVisual) simRuleVisual.textContent = scenario.visualTone;

    renderPaletteSwatches(scenario.palette);

    if (simMultiPreviewImg) {
      simMultiPreviewImg.src = scenario.image;
      simMultiPreviewImg.alt = `${scenario.brandName} çoklu format önizlemesi`;
    }
    if (simMultiFormatLabel) simMultiFormatLabel.textContent = scenario.multiFormatLabel;

    if (simArtworkImg) {
      simArtworkImg.src = scenario.image;
      simArtworkImg.alt = `${scenario.brandName} - ${scenario.formatBadge}`;
    }
    if (simArtworkFrame) {
      simArtworkFrame.style.aspectRatio = scenario.aspectRatio;
      simArtworkFrame.classList.remove("is-revised");
    }
    if (simReadyBadge) simReadyBadge.textContent = "✓ 3 Formatta Tasarımlar Hazır!";
    if (simFormatTag) simFormatTag.textContent = scenario.formatBadge;
    if (simReviseExample) simReviseExample.textContent = `"${scenario.reviseExample}"`;

    presetBtns.forEach((btn, idx) => {
      btn.classList.toggle("is-active", idx === currentScenarioIndex);
    });
  }

  function startTypewriter(fullText) {
    if (typingTimer) {
      clearInterval(typingTimer);
      typingTimer = null;
    }
    if (!simPromptText) return;

    if (reducedMotionQuery.matches) {
      simPromptText.textContent = fullText;
      return;
    }

    simPromptText.textContent = "";
    let charIdx = 0;
    typingTimer = setInterval(() => {
      if (charIdx < fullText.length) {
        simPromptText.textContent += fullText.charAt(charIdx);
        charIdx++;
      } else {
        clearInterval(typingTimer);
        typingTimer = null;
      }
    }, 16);
  }

  presetBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.simPreset, 10);
      if (Number.isNaN(idx) || !SCENARIOS[idx]) return;
      currentScenarioIndex = idx;
      const scenario = SCENARIOS[idx];
      applyScenarioData(scenario);
      if (activeStepInPhase === 0) {
        startTypewriter(scenario.prompt);
      } else if (simPromptText) {
        simPromptText.textContent = scenario.prompt;
      }
    });
  });

  if (reviseBtn && simArtworkFrame && simReadyBadge) {
    reviseBtn.addEventListener("click", () => {
      simArtworkFrame.classList.toggle("is-revised");
      const isRevised = simArtworkFrame.classList.contains("is-revised");
      simReadyBadge.textContent = isRevised
        ? "✓ Revizyon 1.4 sn İçinde Uygulandı!"
        : "✓ 3 Formatta Tasarımlar Hazır!";
    });
  }

  if (dlBtn && simReadyBadge) {
    dlBtn.addEventListener("click", () => {
      simReadyBadge.textContent = "✓ PNG & WebP Paketleri Hazırlandı!";
    });
  }

  applyScenarioData(SCENARIOS[0]);

  return {
    syncStep(stepIdx, { shouldAnimate = false } = {}) {
      activeStepInPhase = stepIdx;
      const scenario = SCENARIOS[currentScenarioIndex];
      applyScenarioData(scenario);
      if (stepIdx === 0 && shouldAnimate) {
        startTypewriter(scenario.prompt);
      } else if (simPromptText && !simPromptText.textContent.trim()) {
        simPromptText.textContent = scenario.prompt;
      }
    }
  };
}

export function initFlow() {
  const sectionEl = document.querySelector("[data-unified-pinned]");
  if (!sectionEl) return;

  const shell = sectionEl.querySelector("[data-unified-shell]");
  const frame = sectionEl.querySelector("[data-unified-frame]");
  const headerKicker = sectionEl.querySelector("[data-unified-kicker]");
  const headerTitle = sectionEl.querySelector("[data-unified-title]");
  const phaseTabs = Array.from(sectionEl.querySelectorAll("[data-phase-tab]"));
  const stagePanes = Array.from(sectionEl.querySelectorAll("[data-phase-stage]"));
  const stepsPanes = Array.from(sectionEl.querySelectorAll("[data-phase-steps]"));
  const globalFill = sectionEl.querySelector("[data-unified-progress]");
  const allStepBtns = Array.from(sectionEl.querySelectorAll("[data-unified-step]"));
  const flowScenes = Array.from(sectionEl.querySelectorAll("[data-flow-scene]"));

  const morphStage = sectionEl.querySelector("[data-morph-stage]");
  const morphRatio = sectionEl.querySelector("[data-morph-ratio]");
  const morphBrand = sectionEl.querySelector("[data-morph-brand]");

  const compareStage = sectionEl.querySelector("[data-compare-stage]");
  const compareKicker = sectionEl.querySelector("[data-compare-kicker]");
  const compareBefore = sectionEl.querySelector("[data-compare-before]");
  const compareAfter = sectionEl.querySelector("[data-compare-after]");
  const compareSummary = sectionEl.querySelector("[data-compare-summary]");
  const agencyLabel = sectionEl.querySelector("[data-bar-label-agency]");
  const aiLabel = sectionEl.querySelector("[data-bar-label-ai]");
  const vitrinosLabel = sectionEl.querySelector("[data-bar-label-vitrinos]");
  const compareMilestones = Array.from(sectionEl.querySelectorAll("[data-compare-milestone]"));

  if (!shell || !allStepBtns.length) return;

  const studioSim = createStudioSimulator(sectionEl);
  const desktopQuery = window.matchMedia("(min-width: 800px)");
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const TOTAL_PHASES = 3;
  const STEPS_PER_PHASE = 4;
  const TOTAL_STEPS = TOTAL_PHASES * STEPS_PER_PHASE;

  let activePhase = -1;
  const phaseSteps = [0, 0, 0];
  let manualGlobalOverride = null;
  let lockScrollGlobal = 0;
  let lastScrollGlobal = 0;
  let isVisible = false;
  let scrollTicking = false;

  function renderHeaderMeta(phaseIdx) {
    const meta = PHASE_META[phaseIdx] || PHASE_META[0];
    if (headerKicker) headerKicker.textContent = meta.kicker;
    if (headerTitle) {
      const em = document.createElement("em");
      em.textContent = meta.titleEm;
      headerTitle.replaceChildren(document.createTextNode(meta.titleBefore), em);
    }

    phaseTabs.forEach((tab, idx) => {
      const isSelected = idx === phaseIdx;
      tab.classList.toggle("is-active", isSelected);
      tab.setAttribute("aria-selected", isSelected ? "true" : "false");
    });

    stagePanes.forEach((pane) => {
      const isActive = Number(pane.dataset.phaseStage) === phaseIdx;
      pane.classList.toggle("is-phase-active", isActive);
      pane.setAttribute("aria-hidden", desktopQuery.matches && !isActive ? "true" : "false");
    });
    stepsPanes.forEach((pane) => {
      const isActive = Number(pane.dataset.phaseSteps) === phaseIdx;
      pane.classList.toggle("is-phase-active", isActive);
      pane.setAttribute("aria-hidden", desktopQuery.matches && !isActive ? "true" : "false");
    });
  }

  function applyPhaseVisuals(phaseIdx, stepIdx, { animateTypewriter = false } = {}) {
    const badgeEl = sectionEl.querySelector(`[data-phase-badge="${phaseIdx}"]`);
    const activeBtn = allStepBtns.find(
      (btn) => Number(btn.dataset.phase) === phaseIdx && Number(btn.dataset.phaseStep) === stepIdx
    );
    if (badgeEl && activeBtn?.dataset.stepBadge) {
      badgeEl.textContent = activeBtn.dataset.stepBadge;
    }

    if (phaseIdx === 0) {
      const meta = MORPH_STEPS[stepIdx] || MORPH_STEPS[0];
      if (morphStage) morphStage.setAttribute("data-morph-stage", String(stepIdx));
      if (morphRatio) morphRatio.textContent = meta.ratio;
      if (morphBrand) morphBrand.textContent = meta.brand;
      return;
    }

    if (phaseIdx === 1) {
      flowScenes.forEach((scene, idx) => {
        scene.classList.toggle("is-active", idx === stepIdx);
      });
      studioSim.syncStep(stepIdx, { shouldAnimate: animateTypewriter });
      return;
    }

    if (phaseIdx === 2) {
      const item = COMPARE_STEPS[stepIdx] || COMPARE_STEPS[0];
      if (compareStage) {
        compareStage.setAttribute("data-compare-stage", String(stepIdx));
        compareStage.style.setProperty("--bar-agency", item.agencyPct);
        compareStage.style.setProperty("--bar-ai", item.aiPct);
        compareStage.style.setProperty("--bar-vitrinos", item.vitrinosPct);
      }
      if (compareKicker) compareKicker.textContent = item.kicker;
      if (compareBefore) compareBefore.textContent = item.before;
      if (compareAfter) compareAfter.textContent = item.after;
      if (compareSummary) compareSummary.textContent = item.summary;
      if (agencyLabel) agencyLabel.textContent = item.agencyLabel;
      if (aiLabel) aiLabel.textContent = item.aiLabel;
      if (vitrinosLabel) vitrinosLabel.textContent = item.vitrinosLabel;
      compareMilestones.forEach((chip, idx) => {
        chip.classList.toggle("is-active", idx <= stepIdx);
      });
    }
  }

  function updateBars(phaseIdx, stepIdx, globalProgress = null) {
    if (globalFill) {
      const globalStep = phaseIdx * STEPS_PER_PHASE + stepIdx;
      const pct = globalProgress !== null
        ? globalProgress * 100
        : ((globalStep + 1) / TOTAL_STEPS) * 100;
      globalFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    }

    for (let p = 0; p < TOTAL_PHASES; p++) {
      const pFill = sectionEl.querySelector(`[data-phase-progress="${p}"]`);
      const pStep = phaseSteps[p];
      if (pFill) {
        let localPct;
        if (globalProgress !== null && desktopQuery.matches) {
          const localProgress = Math.min(1, Math.max(0, globalProgress * TOTAL_PHASES - p));
          localPct = localProgress * 100;
        } else {
          localPct = ((pStep + 1) / STEPS_PER_PHASE) * 100;
        }
        pFill.style.width = `${localPct}%`;
      }

      const pane = sectionEl.querySelector(`[data-phase-steps="${p}"]`);
      if (!pane) continue;
      const fills = pane.querySelectorAll("[data-unified-step-fill]");
      fills.forEach((fill, idx) => {
        if (globalProgress !== null && desktopQuery.matches && p === phaseIdx) {
          const phaseLocal = Math.min(1, Math.max(0, globalProgress * TOTAL_PHASES - p));
          const stepLocal = Math.min(1, Math.max(0, phaseLocal * STEPS_PER_PHASE - idx));
          fill.style.width = `${stepLocal * 100}%`;
        } else {
          fill.style.width = idx <= pStep ? "100%" : "0%";
        }
      });
    }
  }

  function activatePhaseStep(phaseIdx, stepIdx, { globalProgress = null, forceVisuals = false } = {}) {
    const p = Math.max(0, Math.min(TOTAL_PHASES - 1, phaseIdx));
    const s = Math.max(0, Math.min(STEPS_PER_PHASE - 1, stepIdx));
    const phaseChanged = p !== activePhase;
    const stepChanged = s !== phaseSteps[p];

    activePhase = p;
    phaseSteps[p] = s;

    if (phaseChanged) {
      renderHeaderMeta(p);
    }

    if (phaseChanged || stepChanged || forceVisuals) {
      allStepBtns.forEach((btn) => {
        if (Number(btn.dataset.phase) !== p) return;
        const isActive = Number(btn.dataset.phaseStep) === s;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-selected", isActive ? "true" : "false");
      });

      const animateTypewriter = p === 1 && s === 0 && (phaseChanged || stepChanged || forceVisuals);
      applyPhaseVisuals(p, s, { animateTypewriter });
    }

    updateBars(p, s, globalProgress);
  }

  function getShellTravelMetrics() {
    const rect = shell.getBoundingClientRect();
    const headerOffset = 76;
    const frameH = frame ? frame.offsetHeight : 620;
    const totalTravel = Math.max(1, rect.height - frameH);
    const shellTopDoc = (window.scrollY || window.pageYOffset || 0) + rect.top;
    return { rect, headerOffset, totalTravel, shellTopDoc };
  }

  function syncWithScroll() {
    if (!desktopQuery.matches) return;

    const { rect, headerOffset, totalTravel } = getShellTravelMetrics();
    const scrolled = headerOffset - rect.top;
    const progress = Math.min(1, Math.max(0, scrolled / totalTravel));

    shell.style.setProperty("--reveal", progress.toFixed(4));

    const scrollGlobal = Math.min(TOTAL_STEPS - 1, Math.floor(progress * TOTAL_STEPS));
    if (manualGlobalOverride !== null && scrollGlobal !== lockScrollGlobal) {
      manualGlobalOverride = null;
    }
    lastScrollGlobal = scrollGlobal;

    const targetGlobal = manualGlobalOverride !== null ? manualGlobalOverride : scrollGlobal;
    const p = Math.floor(targetGlobal / STEPS_PER_PHASE);
    const s = targetGlobal % STEPS_PER_PHASE;

    activatePhaseStep(p, s, {
      globalProgress: manualGlobalOverride !== null ? null : progress
    });
  }

  function scrollToPhase(phaseIdx) {
    const clampedPhase = Math.max(0, Math.min(TOTAL_PHASES - 1, phaseIdx));
    const behavior = reducedMotionQuery.matches ? "auto" : "smooth";

    if (!desktopQuery.matches) {
      const targetCard = sectionEl.querySelector(`[data-phase-stage="${clampedPhase}"]`);
      if (targetCard) {
        const y = targetCard.getBoundingClientRect().top + (window.scrollY || 0) - 82;
        window.scrollTo({ top: Math.max(0, y), behavior });
      }
      return;
    }

    const { headerOffset, totalTravel, shellTopDoc } = getShellTravelMetrics();
    const targetProgress = clampedPhase === 0 ? 0.01 : (clampedPhase / TOTAL_PHASES) + 0.015;
    const targetY = Math.max(0, shellTopDoc - headerOffset + totalTravel * targetProgress);

    manualGlobalOverride = null;
    window.scrollTo({ top: targetY, behavior });
  }

  function handleScroll() {
    if (!desktopQuery.matches || !isVisible || scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      syncWithScroll();
      scrollTicking = false;
    });
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting;
          if (entry.isIntersecting && desktopQuery.matches) {
            syncWithScroll();
          }
        });
      },
      { rootMargin: "220px 0px 220px 0px", threshold: 0 }
    );
    observer.observe(shell);
  }

  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener(
    "resize",
    () => {
      renderHeaderMeta(Math.max(0, activePhase));
      if (desktopQuery.matches) {
        syncWithScroll();
      } else {
        shell.style.setProperty("--reveal", "1");
        for (let p = 0; p < TOTAL_PHASES; p++) {
          applyPhaseVisuals(p, phaseSteps[p]);
        }
        updateBars(Math.max(0, activePhase), phaseSteps[Math.max(0, activePhase)], null);
      }
    },
    { passive: true }
  );

  phaseTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const p = parseInt(tab.dataset.phaseTab, 10);
      if (!Number.isNaN(p)) scrollToPhase(p);
    });
  });

  allStepBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = parseInt(btn.dataset.phase, 10);
      const s = parseInt(btn.dataset.phaseStep, 10);
      if (Number.isNaN(p) || Number.isNaN(s)) return;
      manualGlobalOverride = p * STEPS_PER_PHASE + s;
      lockScrollGlobal = lastScrollGlobal;
      activatePhaseStep(p, s, { forceVisuals: true });
    });
  });

  // Navbar, Hero ve Footer'daki #vitrin / #nasil-calisir / #neden-vitrinos linklerini birleşik faza yönlendir
  const phaseHashMap = {
    "#vitrin": 0,
    "#nasil-calisir": 1,
    "#neden-vitrinos": 2
  };

  document.querySelectorAll('a[href="#vitrin"], a[href="#nasil-calisir"], a[href="#neden-vitrinos"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (href && Object.prototype.hasOwnProperty.call(phaseHashMap, href)) {
        event.preventDefault();
        scrollToPhase(phaseHashMap[href]);
        if (window.history?.replaceState) {
          window.history.replaceState(null, "", href);
        }
      }
    });
  });

  // İlk yüklemede tüm 3 fazı hazırla (özellikle mobil dikey görünüm için)
  for (let p = 2; p >= 0; p--) {
    applyPhaseVisuals(p, 0, { animateTypewriter: false });
  }
  activatePhaseStep(0, 0, { forceVisuals: true });

  if (desktopQuery.matches) {
    syncWithScroll();
  }

  const initialHash = window.location.hash;
  if (initialHash && Object.prototype.hasOwnProperty.call(phaseHashMap, initialHash)) {
    requestAnimationFrame(() => scrollToPhase(phaseHashMap[initialHash]));
  }
}

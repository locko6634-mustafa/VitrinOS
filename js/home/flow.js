/**
 * VitrinOS — Modern Living Studio Simulator (Flow Controller)
 * 3 Sektör Senaryosu, Daktilo Efekti, Story Tarzı Progress Bar ve
 * Kesintisiz Otomatik Döngülü Canlı Önizleme Simülatörü.
 */

const SCENARIOS = [
  {
    id: "tech",
    prompt: "Yazılım ekibimiz için 'Kıdemli Frontend Geliştirici' arayışımıza özel, modern antrasit tonlarında ve elektrik mavisi vurgulu bir iş ilanı postu hazırla.",
    sector: "Yazılım & SaaS",
    format: "Post (4:5 / 3:4)",
    intent: "Kıdemli Yetenek İlanı",
    tone: "Modern & Minimalist",
    brandName: "Nexus Cloud Labs",
    profileId: "PROFİL: #VO-9042",
    palette: [
      { name: "Elektrik Mavi", hex: "#2b66ff" },
      { name: "Grafit Gece", hex: "#161922" },
      { name: "Beyaz", hex: "#ffffff" }
    ],
    font: "JetBrains Mono / Inter Display",
    logo: "Sol Üst 24px Güvenli Izgara",
    visualTone: "Teknoloji Stüdyosu & Kod Topolojisi",
    image: "assets/sim-tech-hiring.jpg",
    formatBadge: "İş İlanı Postu 4:5",
    aspectRatio: "3 / 4",
    reviseExample: "Arka planı biraz daha koyult ve 'Remote' rozetini öne çıkar"
  },
  {
    id: "coffee",
    prompt: "Hafta sonu gerçekleşecek V60 Demleme ve Latte Art atölyemiz için sıcak fındık tonlarında estetik bir Instagram Story'si oluştur.",
    sector: "Butik Kafe & Gastronomi",
    format: "Story (9:16)",
    intent: "Atölye & Workshop Duyurusu",
    tone: "Sıcak, Organik & Davetkar",
    brandName: "Artisan Roastery Studio",
    profileId: "PROFİL: #VO-7183",
    palette: [
      { name: "Karamel Fındık", hex: "#d49b6a" },
      { name: "Koyu Espresso", hex: "#2a201a" },
      { name: "Doğal Krem", hex: "#faf7f2" }
    ],
    font: "Instrument Sans Bold / Regular",
    logo: "Üst Sol Güvenli Alan",
    visualTone: "Kinfolk Dergi Estetiği & Doğal Işık",
    image: "assets/sim-coffee-workshop.jpg",
    formatBadge: "Story 9:16",
    aspectRatio: "9 / 14",
    reviseExample: "Yazıyı biraz daha büyüt ve 'Sınırlı Kontenjan' etiketini ekle"
  },
  {
    id: "architecture",
    prompt: "Yeni tamamladığımız monokrom penthouse projemizin tanıtımı için galeri estetiğinde, geniş formatlı bir portfolyo lansman görseli hazırla.",
    sector: "Mimarlık & İç Mekan",
    format: "Banner (16:9)",
    intent: "Mimari Proje Lansmanı",
    tone: "Heykelsi, Sessiz Lüks & Galeri",
    brandName: "Monolith Studio Arch",
    profileId: "PROFİL: #VO-5510",
    palette: [
      { name: "Platin Beton", hex: "#e5e5e5" },
      { name: "Kömür Siyahı", hex: "#1a1a1a" },
      { name: "Traverten Bej", hex: "#d9d0c5" }
    ],
    font: "Neue Haas Grotesk / Serif",
    logo: "Sağ Alt Minimalist İmza",
    visualTone: "Traverten Dokusu & Mimari Gölgeler",
    image: "assets/sim-architecture-studio.jpg",
    formatBadge: "Lansman Banner 16:9",
    aspectRatio: "16 / 9",
    reviseExample: "Görsel kontrastını artır ve başlığı tek satıra indir"
  }
];

const STEP_DURATION = 4000; // 4 saniye

export function initFlow() {
  const stepButtons = document.querySelectorAll("[data-flow-step]");
  const scenePanels = document.querySelectorAll("[data-flow-scene]");
  const progressFills = document.querySelectorAll(".step-progress-fill");

  if (!stepButtons.length || !scenePanels.length) return;

  // Rastgele bir senaryo seç
  let currentScenarioIndex = Math.floor(Math.random() * SCENARIOS.length);
  let currentStep = 0;
  let typingTimer = null;
  let stepTimeout = null;

  // DOM Referansları
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

  const simArtworkFrame = document.getElementById("simArtworkFrame");
  const simArtworkImg = document.getElementById("simArtworkImg");
  const simFormatTag = document.getElementById("simFormatTag");
  const simReviseExample = document.getElementById("simReviseExample");

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

    if (simPaletteSwatches) {
      simPaletteSwatches.innerHTML = scenario.palette.map(p => `
        <div class="swatch-item">
          <span class="swatch-color" style="background: ${p.hex}"></span>
          <span class="swatch-meta">${p.name} (<code>${p.hex}</code>)</span>
        </div>
      `).join("");
    }

    if (simArtworkImg) {
      simArtworkImg.src = scenario.image;
      simArtworkImg.alt = `${scenario.brandName} - ${scenario.formatBadge}`;
    }
    if (simArtworkFrame) {
      simArtworkFrame.style.aspectRatio = scenario.aspectRatio;
    }
    if (simFormatTag) simFormatTag.textContent = scenario.formatBadge;
    if (simReviseExample) simReviseExample.textContent = `"${scenario.reviseExample}"`;
  }

  function startTypewriter(fullText) {
    if (typingTimer) clearInterval(typingTimer);
    if (!simPromptText) return;

    simPromptText.textContent = "";
    let charIdx = 0;
    const speed = 20;

    typingTimer = setInterval(() => {
      if (charIdx < fullText.length) {
        simPromptText.textContent += fullText.charAt(charIdx);
        charIdx++;
      } else {
        clearInterval(typingTimer);
        typingTimer = null;
      }
    }, speed);
  }

  function activateStep(stepIndex) {
    currentStep = stepIndex;
    const currentScenario = SCENARIOS[currentScenarioIndex];

    // Önceki zamanlayıcıları temizle
    if (stepTimeout) {
      clearTimeout(stepTimeout);
      stepTimeout = null;
    }

    // Siber Tarama Çizgisi Işıltısı (Scanline Pass)
    const flowVisualCard = document.querySelector(".flow-visual-card");
    if (flowVisualCard) {
      flowVisualCard.classList.remove("is-scanning");
      void flowVisualCard.offsetWidth; // Reflow tetikle
      flowVisualCard.classList.add("is-scanning");
    }

    // Buton ve panel durumları
    stepButtons.forEach((btn, idx) => {
      const isActive = idx === stepIndex;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    scenePanels.forEach((panel, idx) => {
      panel.classList.toggle("is-active", idx === stepIndex);
    });

    // İlerleme çubukları (Story style CSS transition)
    progressFills.forEach((fill, idx) => {
      fill.style.transition = "none";
      if (idx < stepIndex) {
        fill.style.width = "100%";
      } else if (idx > stepIndex) {
        fill.style.width = "0%";
      } else {
        fill.style.width = "0%";
        // Kısa bir frame gecikmesi ile akıcı transition başlat
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            fill.style.transition = `width ${STEP_DURATION}ms linear`;
            fill.style.width = "100%";
          });
        });
      }
    });

    applyScenarioData(currentScenario);

    // Adım 1 ise daktilo animasyonunu başlat
    if (stepIndex === 0) {
      startTypewriter(currentScenario.prompt);
    }

    // Garantili zamanlayıcı ile bir sonraki adıma otomatik geçiş
    stepTimeout = setTimeout(() => {
      nextStep();
    }, STEP_DURATION);
  }

  function nextStep() {
    if (currentStep < 2) {
      activateStep(currentStep + 1);
    } else {
      // 3. Adım tamamlandığında diğer rastgele senaryoya geç!
      currentScenarioIndex = (currentScenarioIndex + 1) % SCENARIOS.length;
      activateStep(0);
    }
  }

  // Kullanıcı herhangi bir adıma tıklarsa anında o adıma geç ve döngüyü oradan sürdür
  stepButtons.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      activateStep(index);
    });
  });

  // İlk adımı başlat
  activateStep(0);
}

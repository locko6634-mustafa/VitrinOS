/**
 * VitrinOS — Hero Canlı Marka & Senaryo Seçicisi + Bento X-Ray Vitrin Denetleyicisi
 * Ziyaretçinin tek tıkla farklı sektörler için marka kurallarını, atmosferik
 * ışıklandırmayı ve format X-Ray kılavuzlarını deneyimlemesini sağlar.
 */

export const SCENARIOS = {
  tech: {
    id: "tech",
    formatMode: "landscape",
    badgeLetter: "S",
    brandName: "Stratos Cloud Systems",
    brandType: "Yazılım & B2B SaaS",
    format: "16:9 LinkedIn / Kariyer İlanı",
    tag: "İŞ İLANI",
    tagBg: "rgba(43, 102, 255, 0.24)",
    tagColor: "#75a2ff",
    headline: "Kıdemli Frontend Mühendisi Aranıyor",
    subtext: "Tam zamanlı uzaktan çalışma, modern web teknolojileri ve global projeler.",
    ctaText: "Pozisyona Başvur",
    ctaBg: "#2b66ff",
    ctaColor: "#ffffff",
    artworkUrl: "assets/hero-tech-workspace.jpg",
    paletteColor: "#2b66ff",
    rules: {
      tone: "Profesyonel & Doğrudan",
      colorCode: "#2b66ff Kobalt",
      safeZone: "Kurumsal Logo Kilitli"
    }
  },
  cafe: {
    id: "cafe",
    formatMode: "portrait",
    badgeLetter: "A",
    brandName: "Artisan Coffee Lab",
    brandType: "Butik Kafe & Atölye",
    format: "9:16 Instagram Story",
    tag: "HAFTA SONU ÖZEL",
    tagBg: "rgba(212, 155, 106, 0.24)",
    tagColor: "#f3c295",
    headline: "Soğuk Demleme & Yeni Tatlılar",
    subtext: "Cumartesi ve Pazar gün boyu taze kavrulmuş çekirdekler ve atölye tadımı.",
    ctaText: "Menüyü İncele",
    ctaBg: "#d49b6a",
    ctaColor: "#1a120c",
    artworkUrl: "assets/showcase-coffee-story.jpg",
    paletteColor: "#d49b6a",
    rules: {
      tone: "Sıcak & Samimi",
      colorCode: "#d49b6a Fındık",
      safeZone: "Doğal Işık & Tipografi"
    }
  },
  agency: {
    id: "agency",
    formatMode: "post",
    badgeLetter: "V",
    brandName: "Vortex Creative",
    brandType: "Kreatif & Dijital Ajans",
    format: "4:5 Instagram Postu",
    tag: "BAŞARI HİKAYESİ",
    tagBg: "rgba(204, 255, 0, 0.22)",
    tagColor: "#ccff00",
    headline: "3 Günde 120.000 Etkileşim",
    subtext: "Marka kurallarına sadık kalarak hazırlanan tutarlı kreatif serinin sonuçları.",
    ctaText: "Vaka Analizini Oku",
    ctaBg: "#ccff00",
    ctaColor: "#0d0e12",
    artworkUrl: "assets/showcase-agency-post.jpg",
    paletteColor: "#ccff00",
    rules: {
      tone: "Cesur & Yüksek Enerji",
      colorCode: "#ccff00 Asit Limon",
      safeZone: "Yüksek Kontrast & Grid"
    }
  },
  fashion: {
    id: "fashion",
    formatMode: "banner",
    badgeLetter: "N",
    brandName: "Natura Studio",
    brandType: "Minimal Tasarım & Perakende",
    format: "16:6 Web Banner",
    tag: "YENİ SEZON",
    tagBg: "rgba(229, 229, 229, 0.22)",
    tagColor: "#f5f5f5",
    headline: "Zamansız Çizgiler, Saf Doku",
    subtext: "Yeni sezon koleksiyonumuz seçili mağazalarda ve dijital vitrinde yayında.",
    ctaText: "Koleksiyonu Keşfet",
    ctaBg: "#f5f5f5",
    ctaColor: "#0d0e12",
    artworkUrl: "assets/showcase-fashion-banner.jpg",
    paletteColor: "#e5e5e5",
    rules: {
      tone: "Zarif & Minimal",
      colorCode: "#e5e5e5 Platin",
      safeZone: "Geniş Negatif Alan"
    }
  }
};

export function initShowcase() {
  initHeroScenarioSwitcher();
  initBentoInspector();
}

function initHeroScenarioSwitcher() {
  const buttons = document.querySelectorAll("[data-scenario-btn]");
  const stageMockup = document.querySelector("[data-stage-mockup]");
  if (!buttons.length || !stageMockup) return;

  const brandBadge = document.querySelector("[data-brand-badge]");
  const brandName = document.querySelector("[data-brand-name]");
  const brandType = document.querySelector("[data-brand-type]");
  const mockupTag = document.querySelector("[data-mockup-tag]");
  const mockupHeadline = document.querySelector("[data-mockup-headline]");
  const mockupSubtext = document.querySelector("[data-mockup-subtext]");
  const mockupCta = document.querySelector("[data-mockup-cta]");
  const mockupFormat = document.querySelector("[data-mockup-format]");
  const ruleTone = document.querySelector("[data-rule-tone]");
  const ruleColor = document.querySelector("[data-rule-color]");
  const ruleSafe = document.querySelector("[data-rule-safe]");
  const paletteDot = document.querySelector("[data-palette-dot]");
  const mockupArtwork = document.querySelector("[data-mockup-artwork]");

  function applyScenario(key) {
    const data = SCENARIOS[key];
    if (!data) return;

    // Gövde atmosfer temasını senaryoya göre güncelle
    if (document.body) {
      document.body.dataset.activeTheme = key;
    }

    // Buton aktiflik ve erişilebilirlik durumu
    buttons.forEach((btn) => {
      const isActive = btn.dataset.scenarioBtn === key;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    stageMockup.dataset.formatMode = data.formatMode;
    stageMockup.style.setProperty("--spotlight-border", data.paletteColor);
    stageMockup.style.setProperty("--spotlight-color", data.tagBg);

    stageMockup.classList.add("is-switching");

    setTimeout(() => {
      if (brandBadge) {
        brandBadge.textContent = data.badgeLetter;
        brandBadge.style.backgroundColor = data.paletteColor;
        brandBadge.style.color = data.id === "agency" || data.id === "cafe" || data.id === "fashion" ? "#06070b" : "#ffffff";
      }
      if (brandName) brandName.textContent = data.brandName;
      if (brandType) brandType.textContent = data.brandType;

      if (mockupTag) {
        mockupTag.textContent = data.tag;
        mockupTag.style.backgroundColor = data.tagBg;
        mockupTag.style.color = data.tagColor;
      }
      if (mockupHeadline) mockupHeadline.textContent = data.headline;
      if (mockupSubtext) mockupSubtext.textContent = data.subtext;

      if (mockupCta) {
        mockupCta.textContent = data.ctaText;
        mockupCta.style.backgroundColor = data.ctaBg;
        mockupCta.style.color = data.ctaColor;
      }
      if (mockupFormat) mockupFormat.textContent = data.format;

      if (ruleTone) ruleTone.textContent = data.rules.tone;
      if (ruleColor) ruleColor.textContent = data.rules.colorCode;
      if (ruleSafe) ruleSafe.textContent = data.rules.safeZone;
      if (paletteDot) paletteDot.style.backgroundColor = data.paletteColor;

      if (mockupArtwork) {
        mockupArtwork.src = data.artworkUrl;
      }

      setTimeout(() => {
        stageMockup.classList.remove("is-switching");
      }, 80);
    }, 150);
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      applyScenario(btn.dataset.scenarioBtn);
    });
  });

  applyScenario("tech");
}

function initBentoInspector() {
  const filterBtns = document.querySelectorAll("[data-mosaic-filter]");
  const cards = document.querySelectorAll(".mosaic-card[data-format-cat]");
  const xrayBtn = document.getElementById("xrayGridToggle");
  const mosaicGrid = document.getElementById("mosaicGrid");

  if (filterBtns.length && cards.length) {
    filterBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.mosaicFilter;
        filterBtns.forEach((b) => b.classList.toggle("is-active", b === btn));

        cards.forEach((card) => {
          if (target === "all") {
            card.classList.remove("is-dimmed", "is-highlighted");
          } else {
            const isMatch = card.dataset.formatCat === target;
            card.classList.toggle("is-highlighted", isMatch);
            card.classList.toggle("is-dimmed", !isMatch);
          }
        });
      });
    });
  }

  if (xrayBtn && mosaicGrid) {
    xrayBtn.addEventListener("click", () => {
      const isPressed = xrayBtn.getAttribute("aria-pressed") === "true";
      const nextState = !isPressed;
      xrayBtn.setAttribute("aria-pressed", nextState ? "true" : "false");
      mosaicGrid.classList.toggle("is-xray-active", nextState);
    });
  }
}

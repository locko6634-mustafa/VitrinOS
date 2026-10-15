/**
 * VitrinOS — Hero Canlı Marka & Senaryo Seçicisi (Interactive Showcase)
 * Ziyaretçinin tek tıkla farklı sektörler için marka kurallarını ve
 * tasarım çıktılarını anında önizlemesini sağlar.
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
    tagBg: "rgba(43, 102, 255, 0.2)",
    tagColor: "#598bff",
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
    tagBg: "rgba(212, 155, 106, 0.2)",
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
    tagBg: "rgba(204, 255, 0, 0.2)",
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
    tagBg: "rgba(229, 229, 229, 0.2)",
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

    // Buton aktiflik durumu
    buttons.forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.scenarioBtn === key);
    });

    // Format modu ile dinamik boyutlandırma (Dikey görsel dikey görünsün)
    stageMockup.dataset.formatMode = data.formatMode;

    // Sahne içerik güncellemesi
    if (brandBadge) {
      brandBadge.textContent = data.badgeLetter;
      brandBadge.style.backgroundColor = data.paletteColor;
      brandBadge.style.color = data.id === "agency" || data.id === "cafe" ? "#0d0e12" : "#ffffff";
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
      mockupArtwork.style.opacity = "0.7";
      setTimeout(() => {
        mockupArtwork.src = data.artworkUrl;
        mockupArtwork.style.opacity = "1";
      }, 100);
    }
  }

  // Tıklama dinleyicileri
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      applyScenario(btn.dataset.scenarioBtn);
    });
  });

  // Varsayılan senaryo
  applyScenario("tech");
}

// VitrinOS Canlı Sektör Dönüştürücü, Revizyon Karşılaştırma ve Bölüm Senkronu (ESM)

const SECTOR_CONFIG = {
  hr: {
    brandName: "KuzeyTek · Kurumsal İK",
    swatches: ["#080d1a", "#2248d8", "#00d4ff"],
    sentence:
      '"Ekibimize uzaktan çalışacak Kıdemli Yazılım Geliştirici arıyoruz, yan haklar ve başvuru detaylarını öne çıkar."',
    photoNote: "Fotoğraf yüklenmedi · Marka kurallarıyla sıfırdan reklam görseli üretildi",
    revisionText:
      'Düzeltme isteği: "Sol alta çalışma modeli kartını ve son başvuru tarihini ekle."',
    defaultAspect: "wide",
    ratioLabel: "16:9 · 1600 × 900",
    imageBase: "assets/ad-hr.webp",
    imageRevised: "assets/ad-hr-rev.webp",
    ruleNote: "KuzeyTek logosu, lacivert-kobalt palet ve ikon dizilimi korundu"
  },
  social: {
    brandName: "KareKültür · Medya & Yayın",
    swatches: ["#0c0c10", "#f59e0b", "#ffffff"],
    sentence:
      '"Bu akşam saat 21:00\'de tasarım dünyasında özgünlük konusunu konuşuyoruz, yeni bölüm duyurusunu hazırla."',
    photoNote: "Stüdyo sahnesi · Marka fontu, ikon listesi ve KareKültür logosu uygulandı",
    revisionText:
      'Düzeltme isteği: "Sol alt kısma konuk ismini ve canlı yayın saat kartını ekle."',
    defaultAspect: "wide",
    ratioLabel: "16:9 · 1600 × 900",
    imageBase: "assets/ad-social.webp",
    imageRevised: "assets/ad-social-rev.webp",
    ruleNote: "KareKültür logosu, kehribar vurgu rengi ve yayın şablonu korundu"
  },
  agency: {
    brandName: "VegaAjans · Dijital Reklam Ajansı",
    swatches: ["#f2f3f5", "#111215", "#e11d48"],
    sentence:
      '"Yeni dönem müşteri kabulümüz başladı; aylık performans verilerimizi ve hızlı teslim avantajımızı anlatan görseli oluştur."',
    photoNote: "Fotoğraf yüklenmedi · Ajans kurumsal şablonu ve veri kartlarıyla üretildi",
    revisionText:
      'Düzeltme isteği: "Sol alta aylık büyüme grafiği kartını ve müşteri puanını ekle."',
    defaultAspect: "wide",
    ratioLabel: "16:9 · 1600 × 900",
    imageBase: "assets/ad-agency.webp",
    imageRevised: "assets/ad-agency-rev.webp",
    ruleNote: "VegaAjans logosu, açık stüdyo zemini ve veri kartı dili korundu"
  },
  event: {
    brandName: "PeraAkademi · Tasarım & Eğitim",
    swatches: ["#f7f3eb", "#ea580c", "#18181b"],
    sentence:
      '"Uygulamalı tasarım ve üretim atölyemiz cumartesi başlıyor, web sitemiz için yatay duyuru afişini hazırla."',
    photoNote: "Yatay Afiş Modu · 1600 × 600 web ve etkinlik duyuru bannerı",
    revisionText:
      'Düzeltme isteği: "Kontenjanın 20 kişiyle sınırlı olduğunu vurgulayan rozeti ekle."',
    defaultAspect: "banner",
    ratioLabel: "Banner · 1600 × 600",
    imageBase: "assets/ad-banner.webp",
    imageRevised: "assets/ad-banner-rev.webp",
    ruleNote: "PeraAkademi logosu, sıcak krem zemin ve turuncu aksiyon butonu korundu"
  }
};

const REVISION_SAMPLES = {
  social: {
    prompt:
      '"Sol alt kısma konuk ismini ve bu akşam 21:00 canlı yayın bilgi kartını ekle."',
    summary: "Konuk kartı ve yayın saati eklendi, KareKültür logosu korundu",
    beforeImg: "assets/ad-social.webp",
    afterImg: "assets/ad-social-rev.webp"
  },
  agency: {
    prompt:
      '"Sol alta aylık +245.000 erişim istatistik kartını ve 4.9 müşteri puanını ekle."',
    summary: "Büyüme grafiği kartı ve puan eklendi, VegaAjans düzeni korundu",
    beforeImg: "assets/ad-agency.webp",
    afterImg: "assets/ad-agency-rev.webp"
  },
  event: {
    prompt:
      '"Başlığın üstüne Son 20 Kişilik Kontenjan ve Cumartesi 14:00 rozetini ekle."',
    summary: "Kontenjan ve saat rozeti eklendi, PeraAkademi banner oranı korundu",
    beforeImg: "assets/ad-banner.webp",
    afterImg: "assets/ad-banner-rev.webp"
  }
};

export function initPipeline() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  initHeroConverter();
  initRevisionShowcase();
  initHeaderChapterSync();
}

function initHeroConverter() {
  const converter = document.getElementById("heroConverter");
  if (!converter) return;

  const sectorTabs = Array.from(converter.querySelectorAll("[data-sector]"));
  const sentenceEl = document.getElementById("converterSentence");
  const photoNoteEl = document.getElementById("converterPhotoNote");
  const brandNameEl = document.getElementById("converterBrandName");
  const swatchesEl = document.getElementById("converterSwatches");
  const revisionTextEl = document.getElementById("converterRevisionText");
  const reviseBtn = document.getElementById("converterReviseBtn");
  const frameEl = document.getElementById("converterFrame");
  const imageEl = document.getElementById("converterImage");
  const statusLabelEl = document.getElementById("converterStatusLabel");
  const brandRuleEl = document.getElementById("converterBrandRule");
  const formatBadgeEl = document.getElementById("converterFormatBadge");

  let activeSector = "hr";
  let isRevised = false;

  function render() {
    const data = SECTOR_CONFIG[activeSector] || SECTOR_CONFIG.hr;

    sectorTabs.forEach((tab) => {
      const selected = tab.dataset.sector === activeSector;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });

    if (sentenceEl) sentenceEl.textContent = data.sentence;
    if (photoNoteEl) photoNoteEl.textContent = data.photoNote;
    if (brandNameEl) brandNameEl.textContent = data.brandName;
    if (revisionTextEl) revisionTextEl.textContent = data.revisionText;
    if (formatBadgeEl) formatBadgeEl.textContent = data.ratioLabel;

    if (swatchesEl) {
      const spans = swatchesEl.querySelectorAll("span");
      data.swatches.forEach((hex, idx) => {
        if (spans[idx]) spans[idx].style.backgroundColor = hex;
      });
    }

    if (reviseBtn) {
      reviseBtn.setAttribute("aria-pressed", String(isRevised));
      reviseBtn.textContent = isRevised
        ? "İlk Üretim Haline Dön"
        : "Düzeltme İsteğini Uygula";
    }

    if (frameEl) {
      frameEl.dataset.aspect = data.defaultAspect;
    }

    if (imageEl) {
      imageEl.src = isRevised ? data.imageRevised : data.imageBase;
    }

    if (statusLabelEl) {
      statusLabelEl.textContent = isRevised
        ? `Revizyon Uygulandı · ${data.ratioLabel}`
        : `İlk Üretim · ${data.ratioLabel}`;
    }

    if (brandRuleEl) {
      brandRuleEl.textContent = data.ruleNote;
    }
  }

  sectorTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activeSector = tab.dataset.sector || "hr";
      isRevised = false;
      render();
    });
  });

  if (reviseBtn) {
    reviseBtn.addEventListener("click", () => {
      isRevised = !isRevised;
      render();
    });
  }

  render();
}

function initRevisionShowcase() {
  const buttons = Array.from(document.querySelectorAll("[data-rev-sample]"));
  const promptEl = document.getElementById("revisionPromptDisplay");
  const summaryEl = document.getElementById("revAfterSummary");
  const beforeImg = document.getElementById("revBeforeImg");
  const afterImg = document.getElementById("revAfterImg");

  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.revSample || "social";
      const sample = REVISION_SAMPLES[key] || REVISION_SAMPLES.social;

      buttons.forEach((b) => b.classList.toggle("is-active", b === btn));
      if (promptEl) promptEl.textContent = sample.prompt;
      if (summaryEl) summaryEl.textContent = sample.summary;
      if (beforeImg) beforeImg.src = sample.beforeImg;
      if (afterImg) afterImg.src = sample.afterImg;
    });
  });
}

function initHeaderChapterSync() {
  const header = document.getElementById("navShell");
  const darkChapters = Array.from(document.querySelectorAll(".chapter-dark"));
  if (!header || !darkChapters.length) return;

  function checkHeaderTheme() {
    const headerBottom = header.getBoundingClientRect().bottom;
    const onDark = darkChapters.some((sec) => {
      const rect = sec.getBoundingClientRect();
      return rect.top <= headerBottom && rect.bottom >= headerBottom;
    });
    header.dataset.theme = onDark ? "dark" : "light";
  }

  window.addEventListener("scroll", checkHeaderTheme, { passive: true });
  checkHeaderTheme();
}

export default initPipeline;

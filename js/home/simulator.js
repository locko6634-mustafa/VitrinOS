// VitrinOS — Canlı Format ve Kullanım Alanı Simülatörü

const SIMULATOR_DATA = {
  categories: {
    social: {
      badge: "Sosyal Medya İçeriği",
      title: "Dijitalde Öne Çıkmanın 3 Kuralı",
      copy: "Markanıza özel kurumsal fontlar, net görsel hiyerarşi ve dikkat çeken başlık yerleşimi.",
      bg: "#151922"
    },
    hiring: {
      badge: "Kariyer & Ekip",
      title: "Kıdemli Yazılım Uzmanı Aranıyor",
      copy: "Kurumsal kimliğinize uygun iş ilanı tasarımı, aranan nitelikler ve başvuru yönlendirmesi.",
      bg: "#161b20"
    },
    campaign: {
      badge: "Kampanya & Tanıtım",
      title: "Büyük Sezon Açılışı",
      copy: "Göz alıcı kampanya afişi, net indirim oranı ve hemen harekete geçiren buton yerleşimi.",
      bg: "#1c1815"
    }
  },
  formats: {
    banner: {
      tag: "Web & LinkedIn Formatı (1600×600)",
      ratio: "16:6 (Web Sitesi & LinkedIn Manşeti)",
      type: "Geniş yatay alan, sol metin bloğu, sağ görsel odağı",
      safe: "Masaüstü ve mobil ekranlarda kusursuz uyum"
    },
    post: {
      tag: "Instagram Gönderi Formatı (1080×1350)",
      ratio: "4:5 (Instagram & Facebook Gönderisi)",
      type: "Kareye yakın dikey alan, merkez görsel ve net metin odağı",
      safe: "Sosyal medya akışında kaydırmayı durduran dikey kompozisyon"
    },
    story: {
      tag: "Hikaye & Reels Formatı (1080×1920)",
      ratio: "9:16 (Hikaye & Reels Tam Ekran)",
      type: "Tam dikey eksen, alt ve üst buton alanları korunan güvenli kadraj",
      safe: "Profil ikonu veya mesaj kutusu metinleri asla kapatmaz"
    }
  }
};

export function initSimulator() {
  if (typeof document === "undefined") return;

  const viewportFrame = document.getElementById("viewportFrame");
  const mockVisual = document.getElementById("mockVisual");
  const sceneBadge = document.getElementById("sceneBadge");
  const sceneTitle = document.getElementById("sceneTitle");
  const sceneCopy = document.getElementById("sceneCopy");
  const safeZoneTag = document.getElementById("safeZoneTag");

  const specRatio = document.getElementById("specRatio");
  const specType = document.getElementById("specType");
  const specSafe = document.getElementById("specSafe");

  const catButtons = Array.from(document.querySelectorAll("#categoryButtons .ctrl-btn"));
  const fmtButtons = Array.from(document.querySelectorAll("#formatButtons .ctrl-btn"));

  if (!viewportFrame) return;

  let currentCategory = "social";
  let currentFormat = "banner";

  function render() {
    const catData = SIMULATOR_DATA.categories[currentCategory];
    const fmtData = SIMULATOR_DATA.formats[currentFormat];

    if (!catData || !fmtData) return;

    viewportFrame.setAttribute("data-active-format", currentFormat);

    if (sceneBadge) sceneBadge.textContent = catData.badge;
    if (sceneTitle) sceneTitle.textContent = catData.title;
    if (sceneCopy) sceneCopy.textContent = catData.copy;
    if (mockVisual) mockVisual.style.backgroundColor = catData.bg;

    if (safeZoneTag) safeZoneTag.textContent = fmtData.tag;
    if (specRatio) specRatio.textContent = fmtData.ratio;
    if (specType) specType.textContent = fmtData.type;
    if (specSafe) specSafe.textContent = fmtData.safe;

    catButtons.forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.category === currentCategory);
    });

    fmtButtons.forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.format === currentFormat);
    });
  }

  catButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.category;
      if (cat && SIMULATOR_DATA.categories[cat]) {
        currentCategory = cat;
        render();
      }
    });
  });

  fmtButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const fmt = btn.dataset.format;
      if (fmt && SIMULATOR_DATA.formats[fmt]) {
        currentFormat = fmt;
        render();
      }
    });
  });

  render();
}

/**
 * VitrinOS — Fiyatlandırma ve Faturalama Seçicisi (Pricing Controller)
 * Aylık / Yıllık faturalandırma seçimine göre fiyatları, indirimleri
 * ve WhatsApp yönlendirme metinlerini dinamik olarak günceller.
 */

export function initPricing() {
  const toggleBtn = document.getElementById("billingToggle");
  const labelMonthly = document.getElementById("labelMonthly");
  const labelYearly = document.getElementById("labelYearly");
  if (!toggleBtn) return;

  const starterPrice = document.querySelector("[data-price-starter]");
  const growthPrice = document.querySelector("[data-price-growth]");
  const starterNote = document.querySelector("[data-note-starter]");
  const growthNote = document.querySelector("[data-note-growth]");

  const starterCta = document.querySelector("[data-cta-starter]");
  const growthCta = document.querySelector("[data-cta-growth]");

  let isYearly = false;

  function updatePricing() {
    toggleBtn.setAttribute("aria-checked", isYearly ? "true" : "false");
    labelMonthly.classList.toggle("is-active", !isYearly);
    labelYearly.classList.toggle("is-active", isYearly);

    if (isYearly) {
      if (starterPrice) starterPrice.textContent = "39";
      if (growthPrice) growthPrice.textContent = "119";
      if (starterNote) starterNote.textContent = "Yıllık faturalandırılır (yılda $468)";
      if (growthNote) growthNote.textContent = "Yıllık faturalandırılır (yılda $1.428)";

      if (starterCta) {
        starterCta.href = "https://wa.me/905510653051?text=" + encodeURIComponent("Merhaba, VitrinOS Başlangıç Planı (Yıllık %20 İndirimli) hakkında bilgi almak istiyorum.");
      }
      if (growthCta) {
        growthCta.href = "https://wa.me/905510653051?text=" + encodeURIComponent("Merhaba, VitrinOS Büyüme Planı (Yıllık %20 İndirimli) hakkında bilgi almak istiyorum.");
      }
    } else {
      if (starterPrice) starterPrice.textContent = "49";
      if (growthPrice) growthPrice.textContent = "149";
      if (starterNote) starterNote.textContent = "Aylık faturalandırılır, taahhüt yok";
      if (growthNote) growthNote.textContent = "Aylık faturalandırılır, taahhüt yok";

      if (starterCta) {
        starterCta.href = "https://wa.me/905510653051?text=" + encodeURIComponent("Merhaba, VitrinOS Başlangıç Planı (Aylık) hakkında bilgi almak istiyorum.");
      }
      if (growthCta) {
        growthCta.href = "https://wa.me/905510653051?text=" + encodeURIComponent("Merhaba, VitrinOS Büyüme Planı (Aylık) hakkında bilgi almak istiyorum.");
      }
    }
  }

  toggleBtn.addEventListener("click", () => {
    isYearly = !isYearly;
    updatePricing();
  });

  if (labelMonthly) {
    labelMonthly.addEventListener("click", () => {
      isYearly = false;
      updatePricing();
    });
  }

  if (labelYearly) {
    labelYearly.addEventListener("click", () => {
      isYearly = true;
      updatePricing();
    });
  }

  // İlk durum
  updatePricing();
}

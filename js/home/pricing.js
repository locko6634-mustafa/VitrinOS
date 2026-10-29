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

  function animatePrice(el, targetVal) {
    if (!el) return;
    const currentVal = parseInt(el.textContent, 10);
    if (currentVal === targetVal) return;

    el.style.transition = "transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.15s ease";
    el.style.transform = "translateY(-6px) scale(0.95)";
    el.style.opacity = "0.3";

    setTimeout(() => {
      el.textContent = String(targetVal);
      el.style.transform = "translateY(6px) scale(0.95)";
      requestAnimationFrame(() => {
        el.style.transform = "translateY(0) scale(1)";
        el.style.opacity = "1";
      });
    }, 150);
  }

  function updatePricing() {
    toggleBtn.setAttribute("aria-checked", isYearly ? "true" : "false");
    labelMonthly.classList.toggle("is-active", !isYearly);
    labelYearly.classList.toggle("is-active", isYearly);

    const discountPill = document.querySelector(".discount-pill");
    if (discountPill) {
      discountPill.style.transform = isYearly ? "scale(1.1)" : "scale(1)";
      discountPill.style.boxShadow = isYearly ? "0 0 12px rgba(204, 255, 0, 0.6)" : "";
      discountPill.style.transition = "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease";
    }

    if (isYearly) {
      animatePrice(starterPrice, 39);
      animatePrice(growthPrice, 119);
      if (starterNote) starterNote.textContent = "Yıllık faturalandırılır (yılda $468)";
      if (growthNote) growthNote.textContent = "Yıllık faturalandırılır (yılda $1.428)";

      if (starterCta) {
        starterCta.href = "https://wa.me/905510653051?text=" + encodeURIComponent("Merhaba, VitrinOS Başlangıç Planı (Yıllık %20 İndirimli) hakkında bilgi almak istiyorum.");
      }
      if (growthCta) {
        growthCta.href = "https://wa.me/905510653051?text=" + encodeURIComponent("Merhaba, VitrinOS Büyüme Planı (Yıllık %20 İndirimli) hakkında bilgi almak istiyorum.");
      }
    } else {
      animatePrice(starterPrice, 49);
      animatePrice(growthPrice, 149);
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

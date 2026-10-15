/**
 * VitrinOS — 3 Adımda Nasıl Çalışır? (Flow Controller)
 * Sol tarafta tıklanan veya otomatik ilerleyen adımlara göre
 * sağ taraftaki sahneyi günceller.
 */

export function initFlow() {
  const stepButtons = document.querySelectorAll("[data-flow-step]");
  const scenePanels = document.querySelectorAll("[data-flow-scene]");
  if (!stepButtons.length || !scenePanels.length) return;

  function activateStep(index) {
    stepButtons.forEach((btn, idx) => {
      btn.classList.toggle("is-active", idx === index);
    });

    scenePanels.forEach((panel, idx) => {
      panel.classList.toggle("is-active", idx === index);
    });
  }

  stepButtons.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      activateStep(index);
    });
  });

  // Varsayılan Adım 1
  activateStep(0);
}

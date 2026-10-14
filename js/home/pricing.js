// VitrinOS Fiyatlandırma ve Billing Toggle Mantığı (ESM & Home)
export function initPricing() {
  if (typeof document === "undefined") return;

  const toggle = document.getElementById("billingToggle");
  const labelMonthly = document.getElementById("label-monthly");
  const labelYearly = document.getElementById("label-yearly");
  const priceValues = document.querySelectorAll(".price-value");
  const yearlyHints = document.querySelectorAll("[data-billing-yearly]");
  const monthlyHints = document.querySelectorAll("[data-billing-monthly]");

  if (!toggle || !priceValues.length) return;

  toggle.addEventListener("click", () => {
    const isYearly = toggle.getAttribute("aria-checked") === "true";
    const nextState = !isYearly;

    toggle.setAttribute("aria-checked", String(nextState));
    labelMonthly?.classList.toggle("active", !nextState);
    labelYearly?.classList.toggle("active", nextState);

    priceValues.forEach((el) => {
      el.style.transition = "opacity 120ms ease, transform 120ms ease";
      el.style.opacity = "0";
      el.style.transform = "translateY(-4px)";

      setTimeout(() => {
        const newVal = nextState ? el.dataset.yearly : el.dataset.monthly;
        el.textContent = newVal;
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      }, 120);
    });

    yearlyHints.forEach((hint) => (hint.hidden = !nextState));
    monthlyHints.forEach((hint) => (hint.hidden = nextState));
  });
}

export default initPricing;

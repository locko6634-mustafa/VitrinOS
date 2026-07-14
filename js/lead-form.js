(function () {
  window.VitrinOS = window.VitrinOS || {};
  const MIN_SUBMIT_SECONDS = 3;

  function setError(field, message) {
    const errorEl = document.querySelector(`[data-error-for="${field.id}"]`);
    if (!errorEl) return;

    errorEl.textContent = message;
    field.setAttribute("aria-invalid", message ? "true" : "false");
  }

  function isValidUrl(value) {
    if (!value.trim()) return true;

    try {
      const parsed = new URL(value);
      return ["http:", "https:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  function validateForm(form, formData) {
    let valid = true;

    const checks = [
      [
        form.elements.name,
        formData.get("name").trim().length >= 2,
        "Ad soyad en az 2 karakter olmali."
      ],
      [
        form.elements.company,
        formData.get("company").trim().length >= 2,
        "Sirket adi gerekli."
      ],
      [
        form.elements.email,
        form.elements.email.validity.valid && formData.get("email").trim(),
        "Gecerli bir e-posta girin."
      ],
      [
        form.elements.website,
        isValidUrl(formData.get("website")),
        "Web sitesi https:// ile baslamali."
      ],
      [
        form.elements.need,
        Boolean(formData.get("need")),
        "Bir aralik secin."
      ]
    ];

    checks.forEach(([field, passes, message]) => {
      setError(field, passes ? "" : message);
      if (!passes) valid = false;
    });

    const startedAt = Number(formData.get("startedAt") || "0");
    const startedAtValid = Number.isFinite(startedAt) && startedAt > 0;
    const elapsedSeconds = startedAtValid ? (Date.now() - startedAt) / 1000 : 0;
    const honeypotValue = String(formData.get("companyFax") || "").trim();

    if (!startedAtValid || elapsedSeconds < MIN_SUBMIT_SECONDS) {
      valid = false;
    }

    if (honeypotValue) {
      valid = false;
    }

    return valid;
  }

  function buildLeadPayload(formData) {
    return {
      name: formData.get("name").trim(),
      company: formData.get("company").trim(),
      email: formData.get("email").trim(),
      website: formData.get("website").trim(),
      need: formData.get("need"),
      note: formData.get("note").trim(),
      startedAt: Number(formData.get("startedAt") || "0"),
      companyFax: String(formData.get("companyFax") || "").trim()
    };
  }

  async function submitLead(payload) {
    const config = window.VitrinOS?.config;
    const functionName = window.VitrinOS?.config?.leadSubmitFunction;
    if (!config?.supabaseUrl || !config?.supabasePublishableKey || !functionName) {
      throw new Error("Lead submit function tanimli degil.");
    }

    const response = await fetch(`${config.supabaseUrl.replace(/\/$/, "")}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.supabasePublishableKey,
        Authorization: `Bearer ${config.supabasePublishableKey}`,
        "x-correlation-id": window.VitrinOS.observability?.getCorrelationId?.() || "",
        traceparent: window.VitrinOS.observability?.getTraceparent?.() || ""
      },
      body: JSON.stringify(payload)
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok || !data?.ok) {
      throw new Error(data?.message || "Basvuru kaydedilemedi.");
    }
  }

  function initLeadForm() {
    const form = document.querySelector("#leadForm");
    const statusEl = document.querySelector("#formStatus");
    const startedAtInput = document.querySelector("#leadStartedAt");

    if (!form || !statusEl) return;

    if (startedAtInput) {
      startedAtInput.value = String(Date.now());
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(form);
      const submitButton = form.querySelector("[type='submit']");
      statusEl.textContent = "";
      statusEl.removeAttribute("data-kind");

      if (!validateForm(form, formData)) {
        statusEl.textContent = "Alanlari kontrol edin; eksik veya hatali bilgi var.";
        statusEl.dataset.kind = "error";
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Kaydediliyor...";
      }

      try {
        await submitLead(buildLeadPayload(formData));
        form.reset();
        if (startedAtInput) {
          startedAtInput.value = String(Date.now());
        }
        statusEl.textContent = "Basvuru alindi. Ekibimiz kaydi inceleyip sizinle iletisime gececek.";
        statusEl.dataset.kind = "success";
      } catch (error) {
        console.error("Lead kaydi basarisiz:", error);
        if (startedAtInput) {
          startedAtInput.value = String(Date.now());
        }
        statusEl.textContent = error?.message || "Basvuru kaydedilemedi. Lutfen tekrar deneyin.";
        statusEl.dataset.kind = "error";
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Basvuru gonder";
        }
      }
    });
  }

  window.VitrinOS.initLeadForm = initLeadForm;
})();

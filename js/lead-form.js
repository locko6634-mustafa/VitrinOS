(function () {
  window.VitrinOS = window.VitrinOS || {};
  const MIN_SUBMIT_SECONDS = window.VitrinOS?.config?.defaults?.lead?.minSubmitSeconds || 3;

  function setError(field, message) {
    const errorEl = document.querySelector(`[data-error-for="${field.id}"]`);
    if (!errorEl) return;

    errorEl.textContent = message;

    if (message) {
      field.setAttribute("aria-invalid", "true");
    } else {
      field.removeAttribute("aria-invalid");
    }
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
    let firstInvalid = null;

    const checks = [
      [
        form.elements.name,
        formData.get("name").trim().length >= 2,
        "Ad soyad en az 2 karakter olmalı."
      ],
      [
        form.elements.company,
        formData.get("company").trim().length >= 2,
        "Şirket adı gerekli."
      ],
      [
        form.elements.email,
        form.elements.email.validity.valid && formData.get("email").trim(),
        "Geçerli bir e-posta girin."
      ],
      [
        form.elements.website,
        isValidUrl(formData.get("website")),
        "Web sitesi http:// veya https:// ile başlamalı."
      ],
      [
        form.elements.need,
        Boolean(formData.get("need")),
        "Bir aralık seçin."
      ]
    ];

    checks.forEach(([field, passes, message]) => {
      setError(field, passes ? "" : message);
      if (!passes) {
        valid = false;
        firstInvalid = firstInvalid || field;
      }
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

    return { valid, firstInvalid };
  }

  function buildLeadPayload(formData) {
    return {
      name: formData.get("name").trim(),
      company: formData.get("company").trim(),
      email: formData.get("email").trim(),
      website: formData.get("website").trim() || undefined,
      need: formData.get("need") || undefined,
      note: formData.get("note").trim() || undefined,
      leadStartedAt: Number(formData.get("startedAt") || "0"),
      companyFax: String(formData.get("companyFax") || "").trim() || undefined
    };
  }

  function getCorrelationId() {
    return window.crypto?.randomUUID ? window.crypto.randomUUID() : String(Date.now());
  }

  async function submitLead(payload) {
    const correlationId = getCorrelationId();
    const result = await window.VitrinOS.api.post("/leads", payload, {
      headers: { "x-correlation-id": correlationId }
    });
    return result;
  }

  function initLeadForm() {
    const form = document.querySelector("#leadForm");
    const statusEl = document.querySelector("#formStatus");
    const startedAtInput = document.querySelector("#leadStartedAt");

    if (!form || !statusEl) return;

    if (startedAtInput) {
      startedAtInput.value = String(Date.now());
    }

    form.addEventListener("input", (event) => {
      const field = event.target;
      if (field?.id && field.matches("input, select, textarea")) {
        setError(field, "");
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(form);
      const submitButton = form.querySelector("[type='submit']");
      statusEl.textContent = "";
      statusEl.removeAttribute("data-kind");

      const validation = validateForm(form, formData);

      if (!validation.valid) {
        statusEl.textContent = "Alanları kontrol edin; eksik veya hatalı bilgi var.";
        statusEl.dataset.kind = "error";
        validation.firstInvalid?.focus();
        return;
      }

      if (submitButton) {
        submitButton.dataset.idleLabel = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = "Kaydediliyor...";
      }

      try {
        const res = await submitLead(buildLeadPayload(formData));
        form.reset();
        if (startedAtInput) {
          startedAtInput.value = String(Date.now());
        }
        statusEl.textContent = res.message || "Başvurunuz alındı. Ekibimiz kaydı inceleyip sizinle iletişime geçecek.";
        statusEl.dataset.kind = "success";
      } catch (error) {
        console.error("Lead kaydı başarısız:", error);
        if (startedAtInput) {
          startedAtInput.value = String(Date.now());
        }
        statusEl.textContent = error?.message || "Başvuru kaydedilemedi. Lütfen tekrar deneyin.";
        statusEl.dataset.kind = "error";
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = submitButton.dataset.idleLabel || "Pilot görüşmesini planla";
        }
      }
    });
  }

  window.VitrinOS.initLeadForm = initLeadForm;
})();

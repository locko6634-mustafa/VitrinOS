(function () {
  window.VitrinOS = window.VitrinOS || {};

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
        "Web sitesi https:// ile başlamalı."
      ],
      [
        form.elements.need,
        Boolean(formData.get("need")),
        "Bir aralık seçin."
      ]
    ];

    checks.forEach(([field, passes, message]) => {
      setError(field, passes ? "" : message);
      if (!passes) valid = false;
    });

    return valid;
  }

  function buildLeadPayload(formData) {
    return {
      name: formData.get("name").trim(),
      company: formData.get("company").trim(),
      email: formData.get("email").trim(),
      website: formData.get("website").trim(),
      need: formData.get("need"),
      note: formData.get("note").trim()
    };
  }

  function initLeadForm() {
    const form = document.querySelector("#leadForm");
    const statusEl = document.querySelector("#formStatus");

    if (!form || !statusEl) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const formData = new FormData(form);
      const submitButton = form.querySelector("[type='submit']");
      statusEl.textContent = "";
      statusEl.removeAttribute("data-kind");

      if (!validateForm(form, formData)) {
        statusEl.textContent = "Alanları kontrol edin; eksik veya hatalı bilgi var.";
        statusEl.dataset.kind = "error";
        return;
      }

      const payload = buildLeadPayload(formData);
      const config = window.VitrinOS.config || {};
      const leadRecord = {
        ...payload,
        calendlyUrl: config.calendlyUrl,
        notificationEmail: config.email,
        capturedAt: new Date().toISOString(),
        mode: "local-application"
      };

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Kaydediliyor...";
      }

      window.setTimeout(() => {
        try {
          window.sessionStorage.setItem("vitrinos_local_lead", JSON.stringify(leadRecord));
        } catch {
          // Session storage kapalıysa form akışı yine başarılı görünmeli.
        }

        form.reset();
        statusEl.textContent = "Başvuru local demo kaydına alındı. Canlı fazda bu akış Supabase, e-posta ve takvim bağlantısına taşınacak.";

        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Başvuru gönder";
        }
      }, 420);
    });
  }

  window.VitrinOS.initLeadForm = initLeadForm;
})();

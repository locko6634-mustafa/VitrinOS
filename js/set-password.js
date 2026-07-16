(function () {
  const form = document.querySelector("#setPasswordForm");
  const status = document.querySelector("#setPasswordStatus");
  const passwordInput = document.querySelector("#newPassword");
  const confirmInput = document.querySelector("#confirmPassword");
  const submitButton = form?.querySelector('button[type="submit"]');
  const submitLabel = submitButton?.querySelector(".button-label");
  const toggleButtons = Array.from(document.querySelectorAll("[data-password-toggle]"));
  const requirements = document.querySelector("#passwordRequirements");

  function setStatus(message, kind) {
    status.textContent = message;
    status.setAttribute("role", kind === "error" ? "alert" : "status");
    if (kind) status.dataset.kind = kind;
    else status.removeAttribute("data-kind");
  }

  function setFormEnabled(enabled) {
    passwordInput.disabled = !enabled;
    confirmInput.disabled = !enabled;
    submitButton.disabled = !enabled;
    toggleButtons.forEach((button) => { button.disabled = !enabled; });
  }

  function setLoading(isLoading) {
    form?.setAttribute("aria-busy", String(isLoading));
    submitButton?.setAttribute("aria-busy", String(isLoading));
    setFormEnabled(!isLoading);
    if (submitLabel) submitLabel.textContent = isLoading ? "Şifre kaydediliyor" : "Şifreyi güvenle kaydet";
  }

  function setInvalid(input, invalid) {
    input?.setAttribute("aria-invalid", String(invalid));
  }

  function updatePasswordStrength() {
    const password = passwordInput.value;
    const characterGroups = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
    let strength = 0;
    if (password.length > 0) strength = 1;
    if (password.length >= 12) strength = 2;
    if (password.length >= 12 && characterGroups >= 3) strength = 3;
    requirements?.setAttribute("data-strength", String(strength));
  }

  function togglePasswordVisibility(button) {
    const input = document.getElementById(button.dataset.passwordToggle || "");
    if (!input) return;
    const willShow = input.type === "password";
    const isConfirmation = input === confirmInput;
    input.type = willShow ? "text" : "password";
    button.setAttribute("aria-pressed", String(willShow));
    button.setAttribute("aria-label", `${isConfirmation ? "Şifre tekrarını" : "Yeni şifreyi"} ${willShow ? "gizle" : "göster"}`);
    const toggleText = button.querySelector(".password-toggle-text");
    if (toggleText) toggleText.textContent = willShow ? "Gizle" : "Göster";
    input.focus({ preventScroll: true });
  }

  toggleButtons.forEach((button) => button.addEventListener("click", () => togglePasswordVisibility(button)));
  passwordInput.addEventListener("input", () => {
    setInvalid(passwordInput, false);
    updatePasswordStrength();
  });
  confirmInput.addEventListener("input", () => setInvalid(confirmInput, false));

  async function initialiseInviteSession() {
    try {
      const client = window.VitrinOS.auth.getClient();
      const { data, error } = await client.auth.getSession();
      if (error) throw error;

      if (!data.session) {
        setStatus("Bu davet bağlantısı geçersiz veya süresi dolmuş. Yöneticinizden yeni davet isteyin.", "error");
        status.focus();
        return;
      }

      window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
      setFormEnabled(true);
      setStatus("Davet doğrulandı. Şimdi çalışma alanı şifreni belirleyebilirsin.", "success");
      passwordInput.focus();
    } catch (error) {
      setStatus(error.message || "Davet bağlantısı doğrulanamadı.", "error");
      status.focus();
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = passwordInput.value;
    const confirmation = confirmInput.value;

    if (password.length < 12) {
      setInvalid(passwordInput, true);
      setStatus("Şifren en az 12 karakter olmalı.", "error");
      passwordInput.focus();
      return;
    }

    if (password !== confirmation) {
      setInvalid(confirmInput, true);
      setStatus("Şifreler eşleşmiyor.", "error");
      confirmInput.focus();
      return;
    }

    setInvalid(passwordInput, false);
    setInvalid(confirmInput, false);
    setLoading(true);
    setStatus("Şifren güvenli biçimde kaydediliyor…", "loading");

    try {
      const client = window.VitrinOS.auth.getClient();
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;

      setStatus("Şifren oluşturuldu. Çalışma alanın açılıyor…", "success");
      window.setTimeout(() => {
        window.location.replace("dashboard.html");
      }, 700);
    } catch (error) {
      setLoading(false);
      setStatus(error.message || "Şifre kaydedilemedi. Davet bağlantısını yeniden açın.", "error");
      status.focus();
    }
  });

  initialiseInviteSession();
})();

(function () {
  const loginForm = document.querySelector("#loginForm");
  const loginStatus = document.querySelector("#loginStatus");
  const identifierInput = document.querySelector("#loginEmail");
  const passwordInput = document.querySelector("#loginPassword");
  const rememberInput = document.querySelector("#rememberLogin");
  const passwordToggle = document.querySelector("#loginPasswordToggle");
  const submitButton = document.querySelector("#loginSubmitButton");
  const submitLabel = submitButton?.querySelector(".button-label");

  function setStatus(message, kind) {
    if (!loginStatus) return;
    loginStatus.textContent = message;
    loginStatus.setAttribute("role", kind === "error" ? "alert" : "status");
    if (kind) {
      loginStatus.dataset.kind = kind;
    } else {
      loginStatus.removeAttribute("data-kind");
    }
  }

  function setLoading(isLoading) {
    loginForm?.setAttribute("aria-busy", String(isLoading));
    if (identifierInput) identifierInput.disabled = isLoading;
    if (passwordInput) passwordInput.disabled = isLoading;
    if (rememberInput) rememberInput.disabled = isLoading;
    if (passwordToggle) passwordToggle.disabled = isLoading;
    if (submitButton) {
      submitButton.disabled = isLoading;
      submitButton.setAttribute("aria-busy", String(isLoading));
    }
    if (submitLabel) submitLabel.textContent = isLoading ? "Oturum doğrulanıyor" : "Güvenli giriş yap";
  }

  function setInvalid(input, invalid) {
    input?.setAttribute("aria-invalid", String(invalid));
  }

  function togglePasswordVisibility() {
    if (!passwordInput || !passwordToggle) return;
    const willShow = passwordInput.type === "password";
    passwordInput.type = willShow ? "text" : "password";
    passwordToggle.setAttribute("aria-pressed", String(willShow));
    passwordToggle.setAttribute("aria-label", willShow ? "Şifreyi gizle" : "Şifreyi göster");
    const toggleText = passwordToggle.querySelector(".password-toggle-text");
    if (toggleText) toggleText.textContent = willShow ? "Gizle" : "Göster";
    passwordInput.focus({ preventScroll: true });
  }

  if (!loginForm) return;

  (async function redirectRememberedUser() {
    try {
      const context = await window.VitrinOS.auth.getCurrentUser();
      if (!context || !window.VitrinOS.auth.hasRememberedLogin(context.user)) return;

      if (context.role === "admin") {
        const mfaSatisfied = context.currentLevel === "aal2" || window.VitrinOS.auth.hasRecentAdminMfa(context.user);
        if (!mfaSatisfied) {
          window.location.replace(context.nextLevel === "aal2" ? "mfa-challenge.html" : "mfa-setup.html");
          return;
        }
      }

      window.location.replace(context.role === "admin" ? "admin.html" : "dashboard.html");
    } catch (error) {
      console.warn("Hatırlanan oturum otomatik açılamadı.", error);
    }
  })();

  passwordToggle?.addEventListener("click", togglePasswordVisibility);
  identifierInput?.addEventListener("input", () => setInvalid(identifierInput, false));
  passwordInput?.addEventListener("input", () => setInvalid(passwordInput, false));

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const identifier = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    const identifierIsInvalid = !identifier;
    const passwordIsInvalid = password.length < 8;
    setInvalid(identifierInput, identifierIsInvalid);
    setInvalid(passwordInput, passwordIsInvalid);

    if (identifierIsInvalid || passwordIsInvalid) {
      setStatus("E-posta veya kullanıcı adını ve en az 8 karakterli şifreni gir.", "error");
      (identifierIsInvalid ? identifierInput : passwordInput)?.focus();
      return;
    }

    setLoading(true);
    setStatus("Oturum güvenli biçimde doğrulanıyor…", "loading");
    let redirecting = false;

    try {
      const { data, error } = await window.VitrinOS.auth.signInWithPassword(identifier, password);

      if (error) {
        setInvalid(identifierInput, true);
        setInvalid(passwordInput, true);
        setStatus("Giriş doğrulanamadı. Bilgilerini kontrol edip yeniden dene.", "error");
        loginStatus?.focus();
        return;
      }

      window.VitrinOS.auth.rememberLogin(data.user, Boolean(rememberInput?.checked));

      const role = window.VitrinOS.auth.getRole(data.user);
      if (role === "admin") {
        const { data: assurance, error: assuranceError } = await window.VitrinOS.auth.getClient().auth.mfa.getAuthenticatorAssuranceLevel();
        if (assuranceError) throw assuranceError;
        const mfaSatisfied = assurance.currentLevel === "aal2" || window.VitrinOS.auth.hasRecentAdminMfa(data.user);
        if (!mfaSatisfied) {
          const target = assurance.nextLevel === "aal2" ? "mfa-challenge.html" : "mfa-setup.html";
          setStatus(target === "mfa-challenge.html" ? "İkinci doğrulama adımına geçiliyor…" : "Yönetici güvenlik kurulumu açılıyor…", "mfa");
          redirecting = true;
          window.location.href = target;
          return;
        }
        setStatus("Kimlik doğrulandı. Admin paneli açılıyor…", "success");
        redirecting = true;
        window.location.href = "admin.html";
        return;
      }

      setStatus("Kimlik doğrulandı. Çalışma alanın açılıyor…", "success");
      redirecting = true;
      window.location.href = "dashboard.html";
    } catch (error) {
      setStatus(error.message || "Güvenli bağlantı kurulamadı. Lütfen yeniden dene.", "error");
      loginStatus?.focus();
    } finally {
      if (!redirecting) setLoading(false);
    }
  });
})();

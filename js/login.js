(function () {
  const loginForm = document.querySelector("#loginForm");
  const loginStatus = document.querySelector("#loginStatus");
  const identifierInput = document.querySelector("#loginEmail");
  const passwordInput = document.querySelector("#loginPassword");
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

  (async function checkExistingSession() {
    try {
      const user = await window.VitrinOS.authStore.fetchSession();
      if (user) {
        window.location.replace(user.role === "admin" ? (user.mfaEnabled ? "admin.html" : "mfa-setup.html") : "dashboard.html");
      }
    } catch (error) {
      // Oturum yoksa devam et
    }
  })();

  passwordToggle?.addEventListener("click", togglePasswordVisibility);
  identifierInput?.addEventListener("input", () => setInvalid(identifierInput, false));
  passwordInput?.addEventListener("input", () => setInvalid(passwordInput, false));

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    const identifierIsInvalid = !email;
    const passwordIsInvalid = password.length < 8;
    setInvalid(identifierInput, identifierIsInvalid);
    setInvalid(passwordInput, passwordIsInvalid);

    if (identifierIsInvalid || passwordIsInvalid) {
      setStatus("E-posta adresini ve en az 8 karakterli şifreni gir.", "error");
      (identifierIsInvalid ? identifierInput : passwordInput)?.focus();
      return;
    }

    setLoading(true);
    setStatus("Oturum güvenli biçimde doğrulanıyor…", "loading");
    let redirecting = false;

    try {
      const response = await window.VitrinOS.api.post("/auth/login", { email, password });

      if (response.mfaRequired) {
        sessionStorage.setItem("mfa_challenge_token", response.challengeToken);
        setStatus("İkinci doğrulama adımına geçiliyor…", "mfa");
        redirecting = true;
        window.location.href = "mfa-challenge.html";
        return;
      }

      const user = response.user;
      setStatus("Kimlik doğrulandı. Yönlendiriliyorsunuz…", "success");
      redirecting = true;
      window.location.href = user?.role === "admin" ? (user.mfaEnabled ? "admin.html" : "mfa-setup.html") : "dashboard.html";
    } catch (error) {
      setInvalid(identifierInput, true);
      setInvalid(passwordInput, true);
      setStatus(error.message || "Giriş doğrulanamadı. Bilgilerini kontrol edip yeniden dene.", "error");
      loginStatus?.focus();
    } finally {
      if (!redirecting) setLoading(false);
    }
  });
})();

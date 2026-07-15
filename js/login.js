(function () {
  const loginForm = document.querySelector("#loginForm");
  const loginStatus = document.querySelector("#loginStatus");

  function setStatus(message, kind) {
    if (!loginStatus) return;
    loginStatus.textContent = message;
    if (kind) {
      loginStatus.dataset.kind = kind;
    } else {
      loginStatus.removeAttribute("data-kind");
    }
  }

  if (!loginForm) return;

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const identifier = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    if (!identifier || password.length < 8) {
      setStatus("Kullanici adi/e-posta ve en az 8 karakterlik sifre gir.", "error");
      return;
    }

    setStatus("Supabase oturumu aciliyor.");

    try {
      const { data, error } = await window.VitrinOS.auth.signInWithPassword(identifier, password);

      if (error) {
        setStatus("Giris basarisiz. Bilgileri kontrol et.", "error");
        return;
      }

      const role = window.VitrinOS.auth.getRole(data.user);
      if (role === "admin") {
        const { data: assurance, error: assuranceError } = await window.VitrinOS.auth.getClient().auth.mfa.getAuthenticatorAssuranceLevel();
        if (assuranceError) throw assuranceError;
        if (assurance.currentLevel !== "aal2") {
          const target = assurance.nextLevel === "aal2" ? "mfa-challenge.html" : "mfa-setup.html";
          setStatus(target === "mfa-challenge.html" ? "MFA kodu bekleniyor." : "Önce yönetici MFA kurulumu tamamlanmalı.");
          window.location.href = target;
          return;
        }
        setStatus("Admin paneline yönlendiriliyorsun.");
        window.location.href = "admin.html";
        return;
      }

      setStatus("Panele yönlendiriliyorsun.");
      window.location.href = "dashboard.html";
    } catch (error) {
      setStatus(error.message || "Supabase baglantisi kurulamadi.", "error");
    }
  });
})();

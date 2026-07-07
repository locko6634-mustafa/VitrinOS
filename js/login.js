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
      setStatus(role === "admin" ? "Admin paneline yonlendiriliyorsun." : "Panele yonlendiriliyorsun.");
      window.location.href = role === "admin" ? "admin.html" : "dashboard.html";
    } catch (error) {
      setStatus(error.message || "Supabase baglantisi kurulamadi.", "error");
    }
  });
})();

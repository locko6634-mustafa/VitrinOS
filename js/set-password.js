(function () {
  const form = document.querySelector("#setPasswordForm");
  const status = document.querySelector("#setPasswordStatus");
  const passwordInput = document.querySelector("#newPassword");
  const confirmInput = document.querySelector("#confirmPassword");
  const submitButton = form?.querySelector('button[type="submit"]');

  function setStatus(message, kind) {
    status.textContent = message;
    if (kind) status.dataset.kind = kind;
    else status.removeAttribute("data-kind");
  }

  function setFormEnabled(enabled) {
    passwordInput.disabled = !enabled;
    confirmInput.disabled = !enabled;
    submitButton.disabled = !enabled;
  }

  async function initialiseInviteSession() {
    try {
      const client = window.VitrinOS.auth.getClient();
      const { data, error } = await client.auth.getSession();
      if (error) throw error;

      if (!data.session) {
        setStatus("Bu davet bağlantısı geçersiz veya süresi dolmuş. Yöneticinizden yeni davet isteyin.", "error");
        return;
      }

      window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
      setFormEnabled(true);
      setStatus("Davet doğrulandı. Şimdi şifreni belirleyebilirsin.");
      passwordInput.focus();
    } catch (error) {
      setStatus(error.message || "Davet bağlantısı doğrulanamadı.", "error");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = passwordInput.value;
    const confirmation = confirmInput.value;

    if (password.length < 8) {
      setStatus("Şifren en az 8 karakter olmalı.", "error");
      passwordInput.focus();
      return;
    }

    if (password !== confirmation) {
      setStatus("Şifreler eşleşmiyor.", "error");
      confirmInput.focus();
      return;
    }

    setFormEnabled(false);
    setStatus("Şifren güvenle kaydediliyor.");

    try {
      const client = window.VitrinOS.auth.getClient();
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;

      setStatus("Şifren oluşturuldu. Panele yönlendiriliyorsun.");
      window.setTimeout(() => {
        window.location.replace("dashboard.html");
      }, 700);
    } catch (error) {
      setFormEnabled(true);
      setStatus(error.message || "Şifre kaydedilemedi. Davet bağlantısını yeniden açın.", "error");
    }
  });

  initialiseInviteSession();
})();

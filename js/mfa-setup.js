(async function () {
  const screen = document.querySelector("#mfa-setup-main");
  const status = document.querySelector("#mfaStatus");
  const enrollPanel = document.querySelector("#mfaEnrollPanel");
  const startButton = document.querySelector("#mfaStartButton");
  const verifyButton = document.querySelector("#mfaVerifyButton");
  const startLabel = startButton?.querySelector(".button-label");
  const verifyLabel = verifyButton?.querySelector(".button-label");
  const restartButton = document.querySelector("#mfaRestartButton");
  const setupForm = document.querySelector("#mfaSetupForm");
  const codeInput = document.querySelector("#mfaCode");
  const qrCode = document.querySelector("#mfaQrCode");
  const manualSecret = document.querySelector("#mfaManualSecret");
  let isVerifying = false;

  function setStatus(message, kind = "") {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", kind === "error");
    status.setAttribute("role", kind === "error" ? "alert" : "status");
    if (kind) status.dataset.kind = kind;
    else status.removeAttribute("data-kind");
  }

  function updateVerifyState() {
    const codeIsComplete = codeInput.value.replace(/\D/g, "").length === 6;
    if (verifyButton) verifyButton.disabled = isVerifying || !codeIsComplete;
  }

  function setStartBusy(busy) {
    if (startButton) {
      startButton.disabled = busy;
      startButton.setAttribute("aria-busy", String(busy));
    }
    if (startLabel) startLabel.textContent = busy ? "Güvenli kod hazırlanıyor" : "Doğrulayıcı uygulamasını bağla";
  }

  function setVerifyBusy(busy) {
    isVerifying = busy;
    setupForm?.setAttribute("aria-busy", String(busy));
    if (verifyButton) verifyButton.setAttribute("aria-busy", String(busy));
    if (restartButton) restartButton.disabled = busy;
    if (codeInput) codeInput.disabled = busy;
    if (verifyLabel) verifyLabel.textContent = busy ? "Kod doğrulanıyor" : "Doğrula ve etkinleştir";
    updateVerifyState();
  }

  async function beginEnrollment() {
    setStartBusy(true);
    screen?.setAttribute("aria-busy", "true");
    setStatus("Sana özel QR kod güvenli biçimde hazırlanıyor…", "loading");
    try {
      const data = await window.VitrinOS.api.post("/auth/mfa/enroll", {});
      const { secret, qrCodeUri } = data;

      if (qrCode) {
        qrCode.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeUri)}`;
        qrCode.hidden = false;
      }
      if (manualSecret) {
        manualSecret.textContent = `Manuel anahtar: ${secret}`;
        manualSecret.hidden = false;
      }
      if (enrollPanel) enrollPanel.hidden = false;
      if (startButton) startButton.hidden = true;
      if (codeInput) codeInput.disabled = false;
      updateVerifyState();
      setStatus("QR kodu uygulamanla tara; ardından üretilen 6 haneli kodu gir.", "mfa");
      codeInput?.focus();
    } catch (error) {
      setStatus(error.message || "MFA kaydı başlatılamadı.", "error");
      status?.focus();
    } finally {
      setStartBusy(false);
      screen?.setAttribute("aria-busy", "false");
    }
  }

  async function verifyEnrollment() {
    const code = codeInput.value.replace(/\D/g, "");
    if (code.length !== 6) {
      codeInput.setAttribute("aria-invalid", "true");
      setStatus("6 haneli doğrulama kodunu gir.", "error");
      codeInput.focus();
      return;
    }

    setVerifyBusy(true);
    setStatus("Kod ve cihaz bağı doğrulanıyor…", "loading");
    try {
      await window.VitrinOS.api.post("/auth/mfa/confirm", { code });
      setStatus("MFA başarıyla aktifleştirildi. Admin paneline yönlendiriliyorsunuz…", "success");
      setTimeout(() => {
        window.location.replace("admin.html");
      }, 1500);
    } catch (error) {
      setVerifyBusy(false);
      codeInput.setAttribute("aria-invalid", "true");
      setStatus(error.message || "Kod doğrulanamadı. Güncel kodla yeniden dene.", "error");
      codeInput.focus();
    }
  }

  startButton?.addEventListener("click", beginEnrollment);
  restartButton?.addEventListener("click", () => {
    if (enrollPanel) enrollPanel.hidden = true;
    if (qrCode) {
      qrCode.hidden = true;
      qrCode.removeAttribute("src");
    }
    if (manualSecret) {
      manualSecret.hidden = true;
      manualSecret.textContent = "";
    }
    if (codeInput) {
      codeInput.value = "";
      codeInput.disabled = true;
      codeInput.setAttribute("aria-invalid", "false");
    }
    if (startButton) {
      startButton.hidden = false;
      startButton.disabled = false;
    }
    updateVerifyState();
    setStatus("Yeni bir doğrulayıcı kaydı oluşturabilirsin.");
  });

  setupForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    verifyEnrollment();
  });

  codeInput?.addEventListener("input", () => {
    codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 6);
    codeInput.setAttribute("aria-invalid", "false");
    updateVerifyState();
  });
})();

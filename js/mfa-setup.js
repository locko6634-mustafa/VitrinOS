(async function () {
  const authContext = await window.VitrinOS.auth.requireAdmin({ redirectTo: "login.html", fallbackTo: "dashboard.html", requireMfa: false });
  if (!authContext) return;

  const client = window.VitrinOS.auth.getClient();
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
  let factorId = "";
  let isVerifying = false;

  function setStatus(message, kind = "") {
    status.textContent = message;
    status.classList.toggle("is-error", kind === "error");
    status.setAttribute("role", kind === "error" ? "alert" : "status");
    if (kind) status.dataset.kind = kind;
    else status.removeAttribute("data-kind");
  }

  function updateVerifyState() {
    const codeIsComplete = codeInput.value.replace(/\D/g, "").length === 6;
    verifyButton.disabled = isVerifying || !factorId || !codeIsComplete;
  }

  function setStartBusy(busy) {
    startButton.disabled = busy;
    startButton.setAttribute("aria-busy", String(busy));
    if (startLabel) startLabel.textContent = busy ? "Güvenli kod hazırlanıyor" : "Doğrulayıcı uygulamasını bağla";
  }

  function setVerifyBusy(busy) {
    isVerifying = busy;
    setupForm?.setAttribute("aria-busy", String(busy));
    verifyButton.setAttribute("aria-busy", String(busy));
    restartButton.disabled = busy;
    codeInput.disabled = busy || !factorId;
    if (verifyLabel) verifyLabel.textContent = busy ? "Kod doğrulanıyor" : "Doğrula ve etkinleştir";
    updateVerifyState();
  }

  async function refreshStatus() {
    const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    if (data.currentLevel === "aal2") {
      setStatus("İkinci adım doğrulaması etkin. Bu oturum AAL2 güvenlik düzeyinde.", "success");
      enrollPanel.hidden = true;
      startButton.hidden = true;
      codeInput.disabled = true;
      return true;
    }
    if (data.nextLevel === "aal2") {
      setStatus("Doğrulayıcı zaten bağlı. Yönetici girişlerinde uygulamadaki kod istenecek.", "success");
      enrollPanel.hidden = true;
      startButton.hidden = true;
      codeInput.disabled = true;
      return true;
    }
    setStatus("Henüz bir doğrulayıcı bağlı değil. Güvenli kurulumu başlatabilirsin.");
    startButton.hidden = false;
    startButton.disabled = false;
    return false;
  }

  async function removePendingFactor() {
    const { data, error } = await client.auth.mfa.listFactors();
    if (error) throw error;
    const pending = (data.totp || []).find((factor) => factor.status === "unverified" && factor.friendly_name === "VitrinOS yönetici");
    if (!pending) return;
    const { error: removeError } = await client.auth.mfa.unenroll({ factorId: pending.id });
    if (removeError) throw removeError;
  }

  async function beginEnrollment() {
    setStartBusy(true);
    screen?.setAttribute("aria-busy", "true");
    setStatus("Sana özel QR kod güvenli biçimde hazırlanıyor…", "loading");
    try {
      await removePendingFactor();
      const { data, error } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "VitrinOS yönetici" });
      if (error) throw error;
      if (!data?.id || !data.totp?.qr_code || !data.totp?.secret) throw new Error("MFA kayıt verisi alınamadı.");
      factorId = data.id;
      const qrValue = String(data.totp.qr_code);
      qrCode.src = qrValue.startsWith("data:")
        ? qrValue
        : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrValue)}`;
      qrCode.hidden = false;
      manualSecret.textContent = `Manuel anahtar: ${data.totp.secret}`;
      manualSecret.hidden = false;
      enrollPanel.hidden = false;
      startButton.hidden = true;
      codeInput.disabled = false;
      updateVerifyState();
      setStatus("QR kodu uygulamanla tara; ardından üretilen 6 haneli kodu gir.", "mfa");
      codeInput.focus();
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
    if (!factorId || code.length !== 6) {
      codeInput.setAttribute("aria-invalid", "true");
      setStatus("6 haneli doğrulama kodunu gir.", "error");
      codeInput.focus();
      return;
    }

    setVerifyBusy(true);
    setStatus("Kod ve cihaz bağı doğrulanıyor…", "loading");
    try {
      const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await client.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
      if (verifyError) throw verifyError;
      factorId = "";
      codeInput.value = "";
      setVerifyBusy(false);
      await refreshStatus();
    } catch (error) {
      setVerifyBusy(false);
      codeInput.setAttribute("aria-invalid", "true");
      setStatus(error.message || "Kod doğrulanamadı. Güncel kodla yeniden dene.", "error");
      codeInput.focus();
    }
  }

  startButton.addEventListener("click", beginEnrollment);
  restartButton.addEventListener("click", () => {
    enrollPanel.hidden = true;
    qrCode.hidden = true;
    qrCode.removeAttribute("src");
    manualSecret.hidden = true;
    manualSecret.textContent = "";
    codeInput.value = "";
    codeInput.disabled = true;
    codeInput.setAttribute("aria-invalid", "false");
    factorId = "";
    startButton.hidden = false;
    startButton.disabled = false;
    updateVerifyState();
    setStatus("Yeni bir doğrulayıcı kaydı oluşturabilirsin.");
  });

  setupForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    verifyEnrollment();
  });

  codeInput.addEventListener("input", () => {
    codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 6);
    codeInput.setAttribute("aria-invalid", "false");
    updateVerifyState();
  });

  try {
    await refreshStatus();
  } catch (error) {
    setStatus(error.message || "MFA durumu alınamadı.", "error");
    status?.focus();
  } finally {
    screen?.setAttribute("aria-busy", "false");
  }
})();

(async function () {
  const authContext = await window.VitrinOS.auth.requireAdmin({ redirectTo: "login.html", fallbackTo: "dashboard.html" });
  if (!authContext) return;

  const client = window.VitrinOS.auth.getClient();
  const status = document.querySelector("#mfaStatus");
  const enrollPanel = document.querySelector("#mfaEnrollPanel");
  const startButton = document.querySelector("#mfaStartButton");
  const verifyButton = document.querySelector("#mfaVerifyButton");
  const restartButton = document.querySelector("#mfaRestartButton");
  const codeInput = document.querySelector("#mfaCode");
  const qrCode = document.querySelector("#mfaQrCode");
  const manualSecret = document.querySelector("#mfaManualSecret");
  let factorId = "";

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  async function refreshStatus() {
    const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    if (data.currentLevel === "aal2") {
      setStatus("MFA doğrulandı. Bu oturum AAL2 güvenlik seviyesinde.");
      enrollPanel.hidden = true;
      startButton.hidden = true;
      return true;
    }
    if (data.nextLevel === "aal2") {
      setStatus("MFA zaten bağlı. Giriş sırasında doğrulayıcı uygulamanızdaki kod kullanılacak.");
      enrollPanel.hidden = true;
      startButton.hidden = true;
      return true;
    }
    setStatus("Henüz bir doğrulayıcı uygulaması bağlı değil.");
    startButton.hidden = false;
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
    startButton.disabled = true;
    setStatus("QR kod hazırlanıyor…");
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
      verifyButton.disabled = false;
      setStatus("Kodu doğrulayıcı uygulamanızla tarayın; ardından 6 haneli kodu girin.");
      codeInput.focus();
    } catch (error) {
      setStatus(error.message || "MFA kaydı başlatılamadı.", true);
      startButton.disabled = false;
    }
  }

  async function verifyEnrollment() {
    const code = codeInput.value.replace(/\D/g, "");
    if (!factorId || code.length !== 6) return setStatus("6 haneli doğrulama kodunu girin.", true);
    verifyButton.disabled = true;
    setStatus("Kod doğrulanıyor…");
    try {
      const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await client.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
      if (verifyError) throw verifyError;
      await refreshStatus();
    } catch (error) {
      setStatus(error.message || "Kod doğrulanamadı. Yeni bir kodla tekrar deneyin.", true);
      verifyButton.disabled = false;
    }
  }

  startButton.addEventListener("click", beginEnrollment);
  restartButton.addEventListener("click", () => {
    enrollPanel.hidden = true;
    qrCode.hidden = true;
    manualSecret.hidden = true;
    codeInput.value = "";
    factorId = "";
    startButton.hidden = false;
    startButton.disabled = false;
    setStatus("Yeni bir doğrulayıcı kaydı oluşturabilirsiniz.");
  });
  verifyButton.addEventListener("click", verifyEnrollment);
  codeInput.addEventListener("input", () => { codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 6); });

  try { await refreshStatus(); } catch (error) { setStatus(error.message || "MFA durumu alınamadı.", true); }
})();

(async function () {
  const authContext = await window.VitrinOS.auth.requireAdmin({ redirectTo: "login.html", fallbackTo: "dashboard.html", requireMfa: false });
  if (!authContext) return;

  const client = window.VitrinOS.auth.getClient();
  const status = document.querySelector("#mfaStatus");
  const codeInput = document.querySelector("#mfaCode");
  const verifyButton = document.querySelector("#mfaVerifyButton");
  const signOutButton = document.querySelector("#mfaSignOutButton");
  let factorId = "";

  const setStatus = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  };

  try {
    const { data, error } = await client.auth.mfa.listFactors();
    if (error) throw error;
    factorId = data.totp?.find((factor) => factor.status === "verified")?.id || "";
    if (!factorId) throw new Error("Etkin bir MFA faktörü bulunamadı. Önce MFA kurulumunu tamamlayın.");
    setStatus("Doğrulayıcı uygulamanızdaki 6 haneli kodu girin.");
    codeInput.focus();
  } catch (error) {
    setStatus(error.message || "MFA faktörü alınamadı.", true);
    verifyButton.disabled = true;
  }

  verifyButton.addEventListener("click", async () => {
    const code = codeInput.value.replace(/\D/g, "");
    if (!factorId || code.length !== 6) return setStatus("6 haneli doğrulama kodunu girin.", true);
    verifyButton.disabled = true;
    setStatus("Kod doğrulanıyor…");
    try {
      const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await client.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
      if (verifyError) throw verifyError;
      window.location.replace("admin.html");
    } catch (error) {
      setStatus(error.message || "Kod doğrulanamadı.", true);
      verifyButton.disabled = false;
    }
  });

  codeInput.addEventListener("input", () => { codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 6); });
  signOutButton.addEventListener("click", () => window.VitrinOS.auth.signOut());
})();

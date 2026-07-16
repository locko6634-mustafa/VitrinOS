(async function () {
  const authContext = await window.VitrinOS.auth.requireAdmin({ redirectTo: "login.html", fallbackTo: "dashboard.html", requireMfa: false });
  if (!authContext) return;

  const client = window.VitrinOS.auth.getClient();
  const screen = document.querySelector("#mfa-main");
  const form = document.querySelector("#mfaChallengeForm");
  const status = document.querySelector("#mfaStatus");
  const codeInput = document.querySelector("#mfaCode");
  const verifyButton = document.querySelector("#mfaVerifyButton");
  const verifyLabel = verifyButton?.querySelector(".button-label");
  const signOutButton = document.querySelector("#mfaSignOutButton");
  let factorId = "";
  let isBusy = true;

  const setStatus = (message, kind = "") => {
    status.textContent = message;
    status.classList.toggle("is-error", kind === "error");
    status.setAttribute("role", kind === "error" ? "alert" : "status");
    if (kind) status.dataset.kind = kind;
    else status.removeAttribute("data-kind");
  };

  const updateVerifyState = () => {
    const codeIsComplete = codeInput.value.replace(/\D/g, "").length === 6;
    verifyButton.disabled = isBusy || !factorId || !codeIsComplete;
  };

  const setBusy = (busy, label = "Doğrula ve devam et") => {
    isBusy = busy;
    screen?.setAttribute("aria-busy", String(busy));
    form?.setAttribute("aria-busy", String(busy));
    verifyButton?.setAttribute("aria-busy", String(busy));
    codeInput.disabled = busy || !factorId;
    if (verifyLabel) verifyLabel.textContent = label;
    updateVerifyState();
  };

  try {
    const { data, error } = await client.auth.mfa.listFactors();
    if (error) throw error;
    factorId = data.totp?.find((factor) => factor.status === "verified")?.id || "";
    if (!factorId) throw new Error("Etkin bir MFA faktörü bulunamadı. Önce MFA kurulumunu tamamlayın.");
    setBusy(false);
    setStatus("Doğrulayıcı uygulamandaki güncel 6 haneli kodu gir.");
    codeInput.focus();
  } catch (error) {
    setBusy(false);
    codeInput.disabled = true;
    updateVerifyState();
    setStatus(error.message || "MFA faktörü alınamadı.", "error");
    status?.focus();
  }

  async function verifyCode() {
    const code = codeInput.value.replace(/\D/g, "");
    if (!factorId || code.length !== 6) {
      codeInput.setAttribute("aria-invalid", "true");
      setStatus("6 haneli doğrulama kodunu gir.", "error");
      codeInput.focus();
      return;
    }

    setBusy(true, "Kod doğrulanıyor");
    setStatus("Kod ve oturum güvenliği doğrulanıyor…", "loading");
    try {
      const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await client.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
      if (verifyError) throw verifyError;
      window.VitrinOS.auth.rememberAdminMfa(authContext.user);
      setStatus("Kimlik doğrulandı. Admin çalışma alanı açılıyor…", "success");
      window.location.replace("admin.html");
    } catch (error) {
      setBusy(false);
      codeInput.setAttribute("aria-invalid", "true");
      setStatus(error.message || "Kod doğrulanamadı. Güncel kodla yeniden dene.", "error");
      codeInput.focus();
    }
  }

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    verifyCode();
  });

  codeInput.addEventListener("input", () => {
    codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 6);
    codeInput.setAttribute("aria-invalid", "false");
    updateVerifyState();
  });

  signOutButton.addEventListener("click", async () => {
    signOutButton.disabled = true;
    setStatus("Oturum güvenli biçimde kapatılıyor…", "loading");
    try {
      await window.VitrinOS.auth.signOut();
    } catch (error) {
      signOutButton.disabled = false;
      setStatus(error.message || "Oturum kapatılamadı. Yeniden dene.", "error");
    }
  });
})();

(async function () {
  const challengeToken = sessionStorage.getItem("mfa_challenge_token");
  const screen = document.querySelector("#mfa-main");
  const form = document.querySelector("#mfaChallengeForm");
  const status = document.querySelector("#mfaStatus");
  const codeInput = document.querySelector("#mfaCode");
  const verifyButton = document.querySelector("#mfaVerifyButton");
  const verifyLabel = verifyButton?.querySelector(".button-label");
  const signOutButton = document.querySelector("#mfaSignOutButton");
  let isBusy = false;

  const setStatus = (message, kind = "") => {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", kind === "error");
    status.setAttribute("role", kind === "error" ? "alert" : "status");
    if (kind) status.dataset.kind = kind;
    else status.removeAttribute("data-kind");
  };

  const updateVerifyState = () => {
    const codeIsComplete = codeInput.value.replace(/\D/g, "").length === 6;
    verifyButton.disabled = isBusy || !codeIsComplete;
  };

  const setBusy = (busy, label = "Doğrula ve devam et") => {
    isBusy = busy;
    screen?.setAttribute("aria-busy", String(busy));
    form?.setAttribute("aria-busy", String(busy));
    verifyButton?.setAttribute("aria-busy", String(busy));
    codeInput.disabled = busy;
    if (verifyLabel) verifyLabel.textContent = label;
    updateVerifyState();
  };

  if (!challengeToken) {
    setStatus("Giriş oturumu bulunamadı. Lütfen tekrar giriş yapın.", "error");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 2000);
    return;
  }

  setStatus("Doğrulayıcı uygulamandaki güncel 6 haneli kodu gir.");
  codeInput.focus();

  async function verifyCode() {
    const code = codeInput.value.replace(/\D/g, "");
    if (code.length !== 6) {
      codeInput.setAttribute("aria-invalid", "true");
      setStatus("6 haneli doğrulama kodunu gir.", "error");
      codeInput.focus();
      return;
    }

    setBusy(true, "Kod doğrulanıyor");
    setStatus("Kod ve oturum güvenliği doğrulanıyor…", "loading");
    try {
      await window.VitrinOS.api.post("/auth/mfa/verify", {
        challengeToken,
        code
      });

      sessionStorage.removeItem("mfa_challenge_token");
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

  codeInput?.addEventListener("input", () => {
    codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 6);
    codeInput.setAttribute("aria-invalid", "false");
    updateVerifyState();
  });

  signOutButton?.addEventListener("click", async () => {
    signOutButton.disabled = true;
    sessionStorage.removeItem("mfa_challenge_token");
    window.location.href = "login.html";
  });
})();

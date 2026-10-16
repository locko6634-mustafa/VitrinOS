// VitrinOS Kullanıcı Girişi (ESM & Login)
import "../shared/observability.js";
import { api } from "../shared/api-client.js";
import { authStore } from "../shared/auth-store.js";

function initShowcase() {
  const showcaseImg = document.querySelector("#loginShowcaseImg");
  const showcaseTag = document.querySelector("#loginShowcaseTag");
  const showcaseSub = document.querySelector("#loginShowcaseSub");
  const showcaseBrand = document.querySelector("#loginShowcaseBrand");
  const showcaseDots = document.querySelectorAll("#loginShowcaseDots .nav-dot");

  if (!showcaseImg || !showcaseTag || !showcaseSub || !showcaseBrand) return;

  const slides = [
    {
      img: "assets/showcase-coffee-story.jpg",
      tag: "Instagram Story (9:16)",
      sub: "Artisan Specialty Coffee Atölyesi — Fındık & Karamel Paleti Doğrulandı",
      brand: "Artisan Coffee Lab"
    },
    {
      img: "assets/sim-tech-hiring.jpg",
      tag: "LinkedIn & Instagram Post (4:5)",
      sub: "Lead Product Designer İlanı — Siber Mavi & Kurumsal Tipografi Doğrulandı",
      brand: "Synthex Core"
    },
    {
      img: "assets/sim-architecture-studio.jpg",
      tag: "Web & Vitrin Bannerı (16:9)",
      sub: "Monolitik Mimarlık Studio Lansmanı — Platinum & Ham Beton Doğrulandı",
      brand: "Nordic Atelier"
    }
  ];

  let currentIndex = 0;
  let timer = null;
  const isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function renderSlide(index) {
    currentIndex = index;
    const slide = slides[index];
    if (!slide) return;

    if (!isReducedMotion) {
      showcaseImg.style.opacity = "0.2";
      showcaseImg.style.transform = "scale(0.98)";
    }

    setTimeout(() => {
      showcaseImg.src = slide.img;
      showcaseTag.textContent = slide.tag;
      showcaseSub.textContent = slide.sub;
      showcaseBrand.textContent = slide.brand;

      if (!isReducedMotion) {
        showcaseImg.style.opacity = "1";
        showcaseImg.style.transform = "scale(1)";
      }

      showcaseDots.forEach((dot, dotIndex) => {
        dot.classList.toggle("is-active", dotIndex === index);
      });
    }, isReducedMotion ? 0 : 180);
  }

  showcaseDots.forEach((dot, dotIndex) => {
    dot.style.cursor = "pointer";
    dot.setAttribute("role", "button");
    dot.setAttribute("aria-label", `Slayt ${dotIndex + 1}'e geç`);
    dot.addEventListener("click", () => {
      if (timer) clearInterval(timer);
      renderSlide(dotIndex);
      if (!isReducedMotion) startTimer();
    });
  });

  function startTimer() {
    timer = setInterval(() => {
      const nextIndex = (currentIndex + 1) % slides.length;
      renderSlide(nextIndex);
    }, 4500);
  }

  if (!isReducedMotion) {
    startTimer();
  }
}

export function initLogin() {
  if (typeof document === "undefined") return;

  initShowcase();

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
      const user = await authStore.fetchSession();
      if (user) {
        window.location.replace(user.role === "admin" ? (user.mfaEnabled ? "admin.html" : "mfa-setup.html") : "dashboard.html");
      }
    } catch {
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
      const response = await api.post("/auth/login", { email, password });

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
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLogin, { once: true });
  } else {
    initLogin();
  }
}

export default initLogin;

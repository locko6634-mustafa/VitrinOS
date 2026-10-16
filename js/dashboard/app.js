// VitrinOS Çalışma Alanı (Dashboard) Uygulama Mantığı (ESM & Dashboard)
import "../shared/observability.js";
import { api } from "../shared/api-client.js";
import { authStore } from "../shared/auth-store.js";
import { sseClient } from "../shared/sse-client.js";
import { config } from "../shared/config.js";

export async function initDashboardApp() {
  const user = await authStore.fetchSession();
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  const dashboardConfig = config.defaults.dashboard;
  const formatConfig = config.defaults.formats;
  const colors = config.defaults.colors;

  const state = {
    jobsToday: 0,
    approvals: 0,
    avgDuration: "-",
    brandMatch: "-",
    currentJob: null,
    brands: [],
    assets: [],
    history: []
  };

  const logoutButtons = Array.from(document.querySelectorAll("[data-dashboard-logout]"));
  const appShell = document.querySelector("#appShell");
  const appMain = document.querySelector("#app-main");
  const appRail = document.querySelector("#dashboardNav");
  const appTopbar = document.querySelector(".app-topbar");
  const appMenuToggle = document.querySelector("#appMenuToggle");
  const appMenuScrim = document.querySelector("#appMenuScrim");
  const adminPanelLink = document.querySelector("#adminPanelLink");
  const mobileAdminPanelLink = document.querySelector("#mobileAdminPanelLink");
  const tabButtons = Array.from(document.querySelectorAll("[data-tab]"));
  const panels = Array.from(document.querySelectorAll(".tab-panel"));
  const briefForm = document.querySelector("#briefForm");
  const briefStatus = document.querySelector("#briefStatus");
  const briefSubmit = document.querySelector("#briefSubmit");
  const sourceImageInput = document.querySelector("#sourceImage");
  const revisionBox = document.querySelector("#revisionBox");
  const revisionText = document.querySelector("#revisionText");
  const approveButton = document.querySelector("#approveButton");
  const reviseButton = document.querySelector("#reviseButton");
  const sendRevisionButton = document.querySelector("#sendRevisionButton");
  const metricJobs = document.querySelector("#metricJobs");
  const metricApprovals = document.querySelector("#metricApprovals");
  const metricDuration = document.querySelector("#metricDuration");
  const metricMatch = document.querySelector("#metricMatch");
  const activeJobTitle = document.querySelector("#activeJobTitle");
  const pipelineCurrent = document.querySelector("#pipelineCurrent");
  const resultTitle = document.querySelector("#resultTitle");
  const resultBrand = document.querySelector("#resultBrand");
  const resultHeadline = document.querySelector("#resultHeadline");
  const resultMeta = document.querySelector("#resultMeta");
  const resultCreative = document.querySelector("#resultCreative");
  const assetGrid = document.querySelector("#assetGrid");
  const historyList = document.querySelector("#historyList");
  const dashboardFeedback = document.querySelector("#dashboardFeedback");
  const dashboardFeedbackText = document.querySelector("#dashboardFeedbackText");
  const dashboardFeedbackTitle = document.querySelector("#dashboardFeedbackTitle");
  const dashboardRetryButton = document.querySelector("#dashboardRetryButton");
  const settingsBrandTitle = document.querySelector("#settingsBrandTitle");
  const settingsToneRule = document.querySelector("#settingsToneRule");
  const settingsBannedWords = document.querySelector("#settingsBannedWords");

  const appContextBrand = document.querySelector("#appContextBrand");
  const appContextUser = document.querySelector("#appContextUser");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const appDrawerQuery = window.matchMedia("(max-width: 960px)");

  if (user.role === "admin") {
    [adminPanelLink, mobileAdminPanelLink].filter(Boolean).forEach((link) => {
      link.hidden = false;
    });
  }

  if (appContextUser && user.email) {
    appContextUser.textContent = user.email;
  }

  function activateTab(tabName) {
    const targetButton = tabButtons.find((button) => button.dataset.tab === tabName);
    const targetPanel = panels.find((panel) => panel.id === `panel-${tabName}`);
    if (!targetButton || !targetPanel || targetButton.classList.contains("is-active")) {
      closeAppMenu({ restoreFocus: true });
      return;
    }

    const updateTab = () => {
      tabButtons.forEach((button) => {
        const isActive = button === targetButton;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", String(isActive));
        button.tabIndex = isActive ? 0 : -1;
      });

      panels.forEach((panel) => {
        const isActive = panel === targetPanel;
        panel.classList.toggle("is-active", isActive);
        panel.hidden = !isActive;
      });
    };

    if (typeof document.startViewTransition === "function" && !prefersReducedMotion.matches) {
      document.startViewTransition(updateTab);
    } else {
      updateTab();
    }

    closeAppMenu({ restoreFocus: true });
  }

  function openAppMenu() {
    if (!appShell || !appMenuToggle || !appRail || !appDrawerQuery.matches) return;
    appShell.classList.add("menu-open");
    document.body.classList.add("app-menu-open");
    appMenuToggle.setAttribute("aria-expanded", "true");
    appMenuToggle.setAttribute("aria-label", "Çalışma alanı menüsünü kapat");
    appRail.inert = false;
    appRail.setAttribute("aria-hidden", "false");
    [
      appMain,
      appTopbar?.querySelector(".brand"),
      appTopbar?.querySelector(".app-context"),
      appTopbar?.querySelector(".app-actions")
    ].filter(Boolean).forEach((target) => {
      target.inert = true;
    });
    if (appMenuScrim) appMenuScrim.hidden = false;
    window.requestAnimationFrame(() => {
      (tabButtons.find((button) => button.classList.contains("is-active")) || tabButtons[0])?.focus();
    });
  }

  function closeAppMenu({ restoreFocus = false } = {}) {
    if (!appShell || !appMenuToggle || !appRail) return;
    const wasOpen = appShell.classList.contains("menu-open");
    appShell.classList.remove("menu-open");
    document.body.classList.remove("app-menu-open");
    appMenuToggle.setAttribute("aria-expanded", "false");
    appMenuToggle.setAttribute("aria-label", "Çalışma alanı menüsünü aç");
    appRail.inert = appDrawerQuery.matches;
    if (appDrawerQuery.matches) appRail.setAttribute("aria-hidden", "true");
    else appRail.removeAttribute("aria-hidden");
    [
      appMain,
      appTopbar?.querySelector(".brand"),
      appTopbar?.querySelector(".app-context"),
      appTopbar?.querySelector(".app-actions")
    ].filter(Boolean).forEach((target) => {
      target.inert = false;
    });
    if (appMenuScrim) appMenuScrim.hidden = true;
    if (restoreFocus && wasOpen) appMenuToggle.focus();
  }

  if (typeof document.startViewTransition === "function") {
    document.documentElement.classList.add("supports-view-transition");
  }

  function setStatus(element, message, kind = "") {
    if (!element) return;
    element.textContent = message;
    element.setAttribute("role", kind === "error" ? "alert" : "status");
    if (kind) element.dataset.kind = kind;
    else element.removeAttribute("data-kind");
  }

  function setPageLoading(isLoading) {
    const cards = document.querySelectorAll(".metric-card, .work-panel, .brief-result");
    cards.forEach(card => card.classList.toggle("is-loading", isLoading));
    if (appMain) appMain.setAttribute("aria-busy", String(isLoading));
    if (dashboardRetryButton) dashboardRetryButton.disabled = isLoading;
  }

  function setLoadFeedback(message = "", kind = "error") {
    if (!dashboardFeedback || !dashboardFeedbackText) return;
    const isVisible = Boolean(message);
    dashboardFeedback.hidden = !isVisible;
    dashboardFeedback.dataset.kind = kind;
    dashboardFeedbackText.textContent = message;
    if (dashboardFeedbackTitle) {
      dashboardFeedbackTitle.textContent = kind === "warning"
        ? "Bazı önizlemeler yüklenemedi."
        : "Çalışma alanı verileri yenilenemedi.";
    }
  }

  function detectFormat(text, override = "auto") {
    if (override && override !== "auto") return override;
    const value = text.toLowerCase();
    if (formatConfig.story.keywords.some((k) => value.includes(k))) return formatConfig.story.name;
    if (formatConfig.banner.keywords.some((k) => value.includes(k))) return formatConfig.banner.name;
    return formatConfig.metaPost.name;
  }

  function statusLabel(status) {
    const mapping = {
      queued: "Sırada",
      dispatching: "Gönderiliyor",
      processing: "Üretiliyor",
      succeeded: "Tamamlandı",
      completed: "Tamamlandı",
      approved: "Onaylandı",
      failed_retryable: "Yeniden Denenecek",
      failed_terminal: "Başarısız",
      cancelled: "İptal Edildi"
    };
    return mapping[status] || status;
  }

  function renderMetrics() {
    if (metricJobs) metricJobs.textContent = String(state.jobsToday);
    if (metricApprovals) metricApprovals.textContent = String(state.approvals);
    if (metricDuration) metricDuration.textContent = state.avgDuration;
    if (metricMatch) metricMatch.textContent = state.brandMatch;
  }

  function renderBrandContext() {
    const brandSelect = document.querySelector("#briefBrand");
    const brandId = brandSelect?.value;
    const selected = state.brands.find((b) => b.id === brandId) || state.brands[0];

    if (!selected) {
      if (appContextBrand) appContextBrand.textContent = "Marka Seçilmedi";
      if (settingsBrandTitle) settingsBrandTitle.textContent = "-";
      if (settingsToneRule) settingsToneRule.textContent = "-";
      if (settingsBannedWords) settingsBannedWords.textContent = "-";
      return;
    }

    if (appContextBrand) appContextBrand.textContent = selected.name;
    if (settingsBrandTitle) settingsBrandTitle.textContent = selected.name;
    if (settingsToneRule) settingsToneRule.textContent = selected.toneRules || "Tanımlanmadı";
    if (settingsBannedWords) {
      settingsBannedWords.textContent = selected.bannedWords && selected.bannedWords.length
        ? selected.bannedWords.join(", ")
        : "Yok";
    }

    state.brandMatch = "%99.4";
    renderMetrics();
  }

  function populateBrandSelect() {
    const brandSelect = document.querySelector("#briefBrand");
    if (!brandSelect) return;

    brandSelect.replaceChildren();
    state.brands.forEach((brand) => {
      const option = document.createElement("option");
      option.value = brand.id;
      option.textContent = brand.name;
      brandSelect.appendChild(option);
    });

    renderBrandContext();
  }

  async function uploadSourceImage(file, brandId) {
    if (!file) return null;

    // 1. Calculate simple hex checksum
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // 2. Request upload URL
    const uploadRes = await window.VitrinOS.api.post("/assets/upload-url", {
      mimeType: file.type || "image/png",
      sizeBytes: file.size,
      checksum,
      purpose: "source_image"
    });

    const { assetId, uploadUrl } = uploadRes;

    // 3. Upload to S3/MinIO
    await window.VitrinOS.api.uploadFile(uploadUrl, file, file.type);

    // 4. Complete asset creation
    const completedAsset = await window.VitrinOS.api.post(`/assets/${assetId}/complete`);
    return completedAsset.id;
  }

  let dataRequestId = 0;

  async function fetchData() {
    const requestId = ++dataRequestId;
    setPageLoading(true);

    try {
      const [userBrands, userJobs] = await Promise.all([
        window.VitrinOS.api.get("/brands"),
        window.VitrinOS.api.get("/jobs")
      ]);

      if (requestId !== dataRequestId) return false;

      state.brands = (userBrands || []).map((b) => ({
        id: b.id,
        name: b.name,
        logoUrl: b.logoUrl || "",
        websiteUrl: b.websiteUrl || "",
        primary: b.colorPalette?.primary || colors.primary,
        secondary: b.colorPalette?.secondary || colors.secondary,
        theme: b.colorPalette?.theme || "koyu",
        toneRules: b.toneRules || "",
        bannedWords: b.bannedWords || []
      }));

      populateBrandSelect();

      const jobsList = userJobs || [];
      const formattedJobs = jobsList.map((job) => ({
        id: job.id,
        title: job.briefText || "İsimsiz Brief",
        briefText: job.briefText,
        format: job.format,
        status: job.status,
        brandId: job.brandId,
        brand: state.brands.find((b) => b.id === job.brandId)?.name || "Bilinmeyen Marka",
        imageUrl: job.imageUrl,
        revisionCount: job.revisionCount || 0,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        lastError: job.lastError
      }));

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      state.jobsToday = formattedJobs.filter((j) => new Date(j.createdAt) >= todayStart).length;
      state.approvals = formattedJobs.filter((j) => ["succeeded", "approved"].includes(j.status)).length;

      state.history = formattedJobs.map((j) => ({
        id: j.id,
        brief: j.briefText,
        format: j.format,
        time: new Date(j.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: j.status
      }));

      state.assets = formattedJobs.filter((j) => ["succeeded", "approved"].includes(j.status)).map((j) => ({
        id: j.id,
        title: j.briefText,
        format: j.format,
        dimensions: j.format === "Banner" ? "1600x600" : j.format === "Story" ? "1080x1920" : "1080x1350",
        status: j.status,
        imageUrl: j.imageUrl,
        brand: j.brand
      }));

      state.currentJob = formattedJobs[0] || null;

      setLoadFeedback("");
      return true;
    } catch (err) {
      console.error("fetchData hatası:", err);
      setLoadFeedback(err.message || "Veriler alınamadı.");
      return false;
    } finally {
      setPageLoading(false);
    }
  }

  function renderResult() {
    const resultStatusChip = document.querySelector("#resultStatusChip");
    const job = state.currentJob;
    if (!job) {
      if (activeJobTitle) activeJobTitle.textContent = "-";
      if (pipelineCurrent) pipelineCurrent.textContent = "Brief bekliyor";
      resultTitle.textContent = "Kreatif Hazırlanıyor";
      resultBrand.textContent = "-";
      resultHeadline.textContent = "Brief Girişi Bekleniyor";
      resultMeta.textContent = "Kreatif alan boş";
      if (resultStatusChip) resultStatusChip.textContent = "Hazır";
      resultCreative.replaceChildren();
      if (approveButton) approveButton.hidden = true;
      if (reviseButton) reviseButton.hidden = true;
      if (revisionBox) revisionBox.hidden = true;
      return;
    }

    if (activeJobTitle) activeJobTitle.textContent = job.title;
    if (pipelineCurrent) pipelineCurrent.textContent = statusLabel(job.status);
    resultTitle.textContent = job.title;
    resultBrand.textContent = job.brand;
    resultHeadline.textContent = `${job.format} önizleme`;
    resultMeta.textContent = `${job.format} · ${statusLabel(job.status)}`;
    if (resultStatusChip) resultStatusChip.textContent = statusLabel(job.status);
    resultCreative.dataset.format = job.format.toLowerCase().replace(" ", "-");
    resultCreative.dataset.status = job.status;
    resultCreative.replaceChildren();

    if (job.imageUrl) {
      const img = document.createElement("img");
      img.src = job.imageUrl;
      img.alt = `${job.format} önizlemesi`;
      img.className = "result-creative-img";
      resultCreative.append(img);
    } else {
      const brandNode = document.createElement("span");
      brandNode.textContent = job.brand;
      const headlineNode = document.createElement("strong");
      headlineNode.textContent = job.title;
      const metaNode = document.createElement("small");
      metaNode.textContent = `${job.format} — ${statusLabel(job.status)}`;
      resultCreative.append(brandNode, headlineNode, metaNode);
    }

    const canApprove = job.status === "succeeded";
    const canRevise = ["succeeded", "approved"].includes(job.status);
    if (approveButton) approveButton.hidden = !canApprove;
    if (reviseButton) reviseButton.hidden = !canRevise;
  }

  function renderAssets() {
    assetGrid.replaceChildren();
    if (!state.assets.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Henüz onaylanmış veya tamamlanmış görsel yok.";
      assetGrid.append(empty);
    } else {
      state.assets.forEach((asset) => {
        const card = document.createElement("article");
        card.className = "asset-card";
        const meta = document.createElement("div");
        meta.className = "asset-meta";
        meta.innerHTML = `<strong>${asset.format}</strong><span>${asset.brand}</span><em>${statusLabel(asset.status)}</em>`;
        card.append(meta);
        assetGrid.append(card);
      });
    }
  }

  function renderHistory() {
    historyList.replaceChildren();
    if (!state.history.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Henüz brief geçmişi yok.";
      historyList.append(empty);
    } else {
      state.history.forEach((item) => {
        const row = document.createElement("article");
        row.className = "history-item";
        row.innerHTML = `<div><strong>${item.brief}</strong><span>${item.format} · ${item.time}</span></div><em>${statusLabel(item.status)}</em>`;
        historyList.append(row);
      });
    }
  }

  function renderAll() {
    renderMetrics();
    renderResult();
    renderAssets();
    renderHistory();
  }

  function setLoading(isLoading) {
    if (briefSubmit) {
      briefSubmit.disabled = isLoading;
      briefSubmit.textContent = isLoading ? "Önizleme hazırlanıyor..." : "Üretimi başlat";
    }
    resultCreative?.classList.toggle("is-loading", isLoading);
  }

  logoutButtons.forEach((button) => {
    button.addEventListener("click", () => window.VitrinOS.authStore.logout());
  });

  tabButtons.forEach((button, index) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
    button.addEventListener("keydown", (event) => {
      const keyActions = {
        ArrowRight: Math.min(index + 1, tabButtons.length - 1),
        ArrowDown: Math.min(index + 1, tabButtons.length - 1),
        ArrowLeft: Math.max(index - 1, 0),
        ArrowUp: Math.max(index - 1, 0),
        Home: 0,
        End: tabButtons.length - 1
      };
      if (!(event.key in keyActions)) return;
      event.preventDefault();
      const target = tabButtons[keyActions[event.key]];
      target?.focus();
      activateTab(target?.dataset.tab);
    });
  });

  appMenuToggle?.addEventListener("click", () => {
    if (appShell?.classList.contains("menu-open")) closeAppMenu({ restoreFocus: true });
    else openAppMenu();
  });

  appMenuScrim?.addEventListener("click", () => closeAppMenu({ restoreFocus: true }));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAppMenu({ restoreFocus: true });
      return;
    }

    if (event.key === "Tab" && appShell?.classList.contains("menu-open")) {
      const focusable = [
        appMenuToggle,
        ...appRail.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')
      ].filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  window.addEventListener("resize", () => closeAppMenu());
  closeAppMenu();

  document.querySelector("#briefBrand")?.addEventListener("change", renderBrandContext);

  reviseButton?.addEventListener("click", () => {
    if (revisionBox) {
      revisionBox.hidden = false;
      revisionText?.focus();
      setStatus(briefStatus, "Revizyon notunu yazıp gönderin.");
    }
  });

  const fileChosenPill = document.querySelector("#fileChosenPill");
  const fileChosenName = document.querySelector("#fileChosenName");
  const fileClearBtn = document.querySelector("#fileClearBtn");
  const quickChips = Array.from(document.querySelectorAll(".quick-chip"));
  const briefTextArea = document.querySelector("#briefText");

  quickChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      if (!briefTextArea) return;
      briefTextArea.value = chip.dataset.quick || "";
      briefTextArea.focus();
    });
  });

  sourceImageInput?.addEventListener("change", () => {
    const file = sourceImageInput.files?.[0];
    if (file && fileChosenPill && fileChosenName) {
      fileChosenName.textContent = file.name;
      fileChosenPill.hidden = false;
    } else if (fileChosenPill) {
      fileChosenPill.hidden = true;
    }
  });

  fileClearBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (sourceImageInput) sourceImageInput.value = "";
    if (fileChosenPill) fileChosenPill.hidden = true;
  });

  dashboardRetryButton?.addEventListener("click", async () => {
    await fetchData();
    renderAll();
  });

  briefForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(briefForm);
    const brief = String(formData.get("brief") || "").trim();
    const brandId = formData.get("brand");

    if (brief.length < dashboardConfig.briefMinLength) {
      setStatus(briefStatus, "Brief en az 12 karakter olmalı.", "error");
      return;
    }

    if (!brandId) {
      setStatus(briefStatus, "Lütfen bir marka seçin.", "error");
      return;
    }

    setStatus(briefStatus, "Brief API'ye kaydediliyor...");
    setLoading(true);

    const format = detectFormat(brief, formData.get("format"));
    const sourceImage = sourceImageInput?.files?.[0] || null;

    try {
      let imageId = null;
      if (sourceImage) {
        setStatus(briefStatus, "Ürün görseli depolama alanına yükleniyor...");
        imageId = await uploadSourceImage(sourceImage, brandId);
      }

      setStatus(briefStatus, "Üretim akışı başlatılıyor...");

      const idempotencyKey = crypto.randomUUID();
      await window.VitrinOS.api.post("/jobs", {
        brandId,
        briefText: brief,
        format,
        imageId
      }, {
        headers: { "Idempotency-Key": idempotencyKey }
      });

      await fetchData();
      if (sourceImageInput) sourceImageInput.value = "";
      if (fileChosenPill) fileChosenPill.hidden = true;
      setLoading(false);
      setStatus(briefStatus, "Üretim akışı başladı. Canlı durum güncellenecektir.");
      renderAll();
    } catch (err) {
      console.error(err);
      setStatus(briefStatus, "Hata oluştu: " + err.message, "error");
      setLoading(false);
    }
  });

  approveButton?.addEventListener("click", async () => {
    if (!state.currentJob) return;
    setStatus(briefStatus, "Onaylandı olarak işaretleniyor...");
    setLoading(true);
    try {
      await window.VitrinOS.api.post(`/jobs/${state.currentJob.id}/approve`, {});
      await fetchData();
      setStatus(briefStatus, "Kreatif onaylandı.");
      renderAll();
    } catch (err) {
      setStatus(briefStatus, "Onaylama hatası: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  });

  sendRevisionButton?.addEventListener("click", async () => {
    if (!state.currentJob) return;
    const note = revisionText?.value.trim() || "";
    if (note.length < dashboardConfig.revisionMinLength) {
      setStatus(briefStatus, "Revizyon notu en az 6 karakter olmalı.", "error");
      return;
    }

    setLoading(true);
    setStatus(briefStatus, "Revizyon talebi gönderiliyor...");

    try {
      await window.VitrinOS.api.post(`/jobs/${state.currentJob.id}/revision`, { revisionNote: note });
      await fetchData();
      setLoading(false);
      if (revisionBox) revisionBox.hidden = true;
      if (revisionText) revisionText.value = "";
      setStatus(briefStatus, "Revizyon talebi gönderildi.");
      renderAll();
    } catch (err) {
      setStatus(briefStatus, "Revizyon hatası: " + err.message, "error");
      setLoading(false);
    }
  });

  // SSE canlı durum takibi
  sseClient.subscribe(async () => {
    await fetchData();
    renderAll();
  });

  // Başlangıç
  await fetchData();
  renderAll();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDashboardApp, { once: true });
  } else {
    initDashboardApp();
  }
}

export default initDashboardApp;

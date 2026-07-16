(async function () {
  const authContext = await window.VitrinOS.auth.requireAuthenticated({
    redirectTo: "login.html"
  });

  if (!authContext) return;

  const client = window.VitrinOS.auth.getClient();

  const dashboardConfig = window.VitrinOS.config.defaults.dashboard;
  const formatConfig = window.VitrinOS.config.defaults.formats;
  const colors = window.VitrinOS.config.defaults.colors;
  const JOB_PAGE_SIZE = dashboardConfig.jobPageSize;
  const JOB_SELECT = 'id,user_id,brand_id,brief_text,format,status,image_url,revision_count,revision_note,brief_json,created_at,updated_at,last_error,retry_count,max_retries,next_retry_at';
  const state = {
    jobsToday: 0,
    approvals: 0,
    avgDuration: "-",
    brandMatch: "-",
    currentJob: null,
    brands: [],
    formatSample: [],
    assets: [],
    history: [],
    assetPage: 0,
    historyPage: 0,
    hasMoreAssets: false,
    hasMoreHistory: false
  };

  const logoutButtons = Array.from(document.querySelectorAll("[data-dashboard-logout]"));
  const appShell = document.querySelector("#appShell");
  const appMain = document.querySelector("#app-main");
  const appRail = document.querySelector("#dashboardNav");
  const appTopbar = document.querySelector(".app-topbar");
  const appMenuToggle = document.querySelector("#appMenuToggle");
  const appMenuScrim = document.querySelector("#appMenuScrim");
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
  const pipelineList = document.querySelector("#pipelineList");
  const barBanner = document.querySelector("#barBanner");
  const barMetaPost = document.querySelector("#barMetaPost");
  const barStory = document.querySelector("#barStory");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const appDrawerQuery = window.matchMedia("(max-width: 1120px)");

  if (typeof document.startViewTransition === "function") {
    document.documentElement.classList.add("supports-view-transition");
  }

  async function triggerBriefWorkflow(payload) {
    const functionName = window.VitrinOS.config.briefTriggerFunction;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), dashboardConfig.requestTimeoutMs);

    try {
      const { data, error } = await client.functions.invoke(functionName, { 
        body: payload,
        signal: controller.signal
      });

      if (error) throw error;
      if (!data?.ok) {
        throw new Error(data?.message || "Üretim akışı başlatılamadı.");
      }

      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error("İstek zaman aşımına uğradı (15 saniye). Lütfen tekrar deneyin.");
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  let activeRetryTimeoutId = null;

  async function handlePendingRetryAutoTrigger(job) {
    if (activeRetryTimeoutId) {
      clearTimeout(activeRetryTimeoutId);
      activeRetryTimeoutId = null;
    }

    if (!job || job.status !== 'pending_retry' || !job.nextRetryAt) return;

    const nextRetry = new Date(job.nextRetryAt);
    const delay = Math.max(0, nextRetry.getTime() - Date.now());

    console.log(`Job ${job.id} will be retried in ${delay} ms`);

    activeRetryTimeoutId = setTimeout(async () => {
      try {
        setStatus(briefStatus, `Yeniden deneniyor (Deneme #${job.retryCount + 1})...`);
        setLoading(true);
        await triggerBriefWorkflow({
          jobId: job.id,
          isRevision: job.revisionCount > 0
        });
        setStatus(briefStatus, "Yeniden tetikleme başarılı. Akış başlatıldı.");
        await fetchData();
      } catch (err) {
        console.error("Auto retry trigger failed:", err);
        setStatus(briefStatus, "Yeniden deneme tetiklenirken hata oluştu: " + err.message, "error");
        setLoading(false);
      }
    }, delay);
  }

  async function uploadSourceImage(file, brandId) {
    if (!file) return "";

    const functionName = window.VitrinOS.config.sourceImageUploadFunction;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("brandId", brandId);

    const { data, error } = await client.functions.invoke(functionName, {
      body: formData
    });

    if (error) throw error;
    if (!data?.ok || !data.path) {
      throw new Error(data?.message || "Ürün görseli yüklenemedi.");
    }

    return data.path;
  }

  async function runJobAction(payload) {
    const functionName = window.VitrinOS.config.jobActionFunction;
    const { data, error } = await client.functions.invoke(functionName, {
      body: payload
    });

    if (error) throw error;
    if (!data?.ok) {
      throw new Error(data?.message || "Islem tamamlanamadi.");
    }

    return data;
  }

  function setPageLoading(isLoading) {
    const cards = document.querySelectorAll(".metric-card, .work-panel, .brief-result");
    cards.forEach(card => {
      card.classList.toggle("is-loading", isLoading);
    });
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

  function getLoadErrorMessage(error) {
    const rawMessage = String(error?.message || "");
    const normalized = rawMessage.toLowerCase();
    if (normalized.includes("jwt") || normalized.includes("auth") || normalized.includes("session")) {
      return "Oturum doğrulanamadı. Sayfayı yenileyip yeniden giriş yapın.";
    }
    if (normalized.includes("network") || normalized.includes("fetch") || normalized.includes("timeout")) {
      return "Sunucuya ulaşılamadı. Bağlantınızı kontrol edip yeniden deneyin.";
    }
    return rawMessage
      ? `Veri servisi şu anda yanıt veremiyor: ${rawMessage}`
      : "Veri servisi şu anda yanıt veremiyor. Kısa süre sonra yeniden deneyin.";
  }

  function renderFormatBars() {
    const formatNames = Object.values(formatConfig).map((format) => format.name);
    const formats = Object.fromEntries(formatNames.map((name) => [name, 0]));
    const barTargets = {
      [formatConfig.banner.name]: barBanner,
      [formatConfig.metaPost.name]: barMetaPost,
      [formatConfig.story.name]: barStory
    };
    let total = 0;

    state.formatSample.forEach(item => {
      const fmt = item.format;
      if (formats[fmt] !== undefined) {
        formats[fmt]++;
        total++;
      }
    });

    if (total > 0) {
      Object.entries(formats).forEach(([formatName, count]) => {
        const target = barTargets[formatName];
        if (target) target.style.setProperty("--bar", `${Math.round((count / total) * 100)}%`);
      });
    } else {
      Object.values(barTargets).forEach((target) => {
        if (target) target.style.setProperty("--bar", "0%");
      });
    }
  }

  function setStyles(element, styles) {
    Object.assign(element.style, styles);
    return element;
  }

  function createTextElement(tagName, text, styles = {}) {
    const element = document.createElement(tagName);
    element.textContent = text;
    return setStyles(element, styles);
  }

  function createDetailItem(label, value, options = {}) {
    const wrapper = document.createElement("div");
    if (options.spanTwo) wrapper.style.gridColumn = "span 2";

    const labelNode = createTextElement("span", label, { color: "var(--muted)" });
    const valueNode = createTextElement("strong", value || "-", {
      color: options.accent ? "var(--accent-soft)" : "var(--ink)",
      display: "block",
      marginTop: "2px"
    });

    wrapper.append(labelNode, valueNode);
    return wrapper;
  }

  function getFriendlyErrorMessage(rawError) {
    if (!rawError) return "Beklenmeyen bir hata oluştu. Lütfen briefinizi kontrol edip tekrar deneyin.";
    
    const err = String(rawError).toLowerCase();
    
    if (err.includes("rate_limit") || err.includes("rate limit") || err.includes("429")) {
      return "Yapay zeka modelinin yoğunluğu nedeniyle geçici bir sınır aşımı oluştu. Lütfen birkaç dakika sonra tekrar deneyin.";
    }
    if (err.includes("quota") || err.includes("billing") || err.includes("insufficient_quota")) {
      return "Yapay zeka servisinin kullanım limiti doldu. Lütfen sistem yöneticisiyle iletişime geçin.";
    }
    if (err.includes("policy") || err.includes("safety") || err.includes("content_policy") || err.includes("content_policy_violation")) {
      return "Brief içeriği yapay zeka güvenlik kurallarına takıldı. Lütfen daha uygun ve genel kelimeler kullanarak tekrar deneyin.";
    }
    if (err.includes("jimp") || err.includes("resize") || err.includes("cover") || err.includes("composite")) {
      return "Görsel işleme veya logo yerleştirme sırasında teknik bir hata oluştu. Lütfen marka logonuzun geçerli bir formatta olduğunu doğrulayın.";
    }
    if (err.includes("download") || err.includes("fetch") || err.includes("getaddrinfo") || err.includes("http request") || err.includes("404")) {
      return "Belirttiğiniz ürün veya arka plan görseli indirilemedi. Lütfen girdiğiniz görsel URL'sinin geçerli ve erişilebilir olduğundan emin olun.";
    }
    if (err.includes("supabase") || err.includes("database") || err.includes("connection") || err.includes("timeout")) {
      return "Sistem bağlantısında geçici bir kesinti oluştu. Lütfen kısa süre sonra tekrar deneyin.";
    }
    
    return `Kreatif üretim sırasında hata oluştu: ${rawError}`;
  }

  let dataRequestId = 0;

  // Operasyon özeti, görsel arşivi ve geçmiş bağımsız sayfalama pencereleriyle yüklenir.
  async function fetchData() {
    const requestId = ++dataRequestId;
    setPageLoading(true);

    try {
      const assetFrom = state.assetPage * JOB_PAGE_SIZE;
      const historyFrom = state.historyPage * JOB_PAGE_SIZE;
      const [brandsResponse, recentResponse, assetsResponse, historyResponse] = await Promise.all([
        client
          .from('brands')
          .select('id,name,logo_url,website_url,color_palette,tone_rules,banned_words'),
        client
          .from('jobs')
          .select(JOB_SELECT)
          .order('created_at', { ascending: false })
          .range(0, JOB_PAGE_SIZE),
        client
          .from('jobs')
          .select(JOB_SELECT)
          .in('status', ['completed', 'approved'])
          .order('created_at', { ascending: false })
          .range(assetFrom, assetFrom + JOB_PAGE_SIZE),
        client
          .from('jobs')
          .select(JOB_SELECT)
          .order('created_at', { ascending: false })
          .range(historyFrom, historyFrom + JOB_PAGE_SIZE)
      ]);

      const queryError = brandsResponse.error || recentResponse.error || assetsResponse.error || historyResponse.error;
      if (queryError) throw queryError;

      const dbBrands = brandsResponse.data || [];
      const recentPage = recentResponse.data || [];
      const assetPage = assetsResponse.data || [];
      const historyPage = historyResponse.data || [];
      const recentJobs = recentPage.slice(0, JOB_PAGE_SIZE);
      const assetJobs = assetPage.slice(0, JOB_PAGE_SIZE);
      const historyJobs = historyPage.slice(0, JOB_PAGE_SIZE);
      const signedUrlCache = new Map();
      const assetLoadFailures = new Set();

      const attachSignedImageUrl = async (job) => {
        let signedImageUrl = "";
        if (!job.image_url || !['completed', 'approved'].includes(job.status)) {
          return { ...job, signedImageUrl };
        }

        try {
          if (!signedUrlCache.has(job.image_url)) {
            signedUrlCache.set(job.image_url, window.VitrinOS.storage.getGeneratedAssetUrl(job.image_url));
          }
          signedImageUrl = await signedUrlCache.get(job.image_url);
        } catch (assetErr) {
          assetLoadFailures.add(job.id);
          console.error("Görsel signed URL hatası:", assetErr);
        }
        return { ...job, signedImageUrl };
      };

      const [recentJobsWithUrls, assetJobsWithUrls] = await Promise.all([
        Promise.all(recentJobs.map(attachSignedImageUrl)),
        Promise.all(assetJobs.map(attachSignedImageUrl))
      ]);

      if (requestId !== dataRequestId) return false;

      state.hasMoreAssets = assetPage.length > JOB_PAGE_SIZE;
      state.hasMoreHistory = historyPage.length > JOB_PAGE_SIZE;
      state.formatSample = recentJobsWithUrls.map((job) => ({ format: job.format }));
      state.brands = dbBrands.map((brand) => ({
        id: brand.id,
        name: brand.name,
        logoUrl: brand.logo_url || "",
        websiteUrl: brand.website_url || "",
        primary: brand.color_palette?.primary || colors.primary,
        secondary: brand.color_palette?.secondary || colors.secondary,
        theme: brand.color_palette?.theme || "koyu",
        toneRules: brand.tone_rules || "",
        bannedWords: brand.banned_words || []
      }));

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      state.jobsToday = recentJobsWithUrls.filter((job) => new Date(job.created_at) >= todayStart).length;
      state.approvals = recentJobsWithUrls.filter((job) => !['approved', 'failed', 'failed_dispatch'].includes(job.status)).length;

      const completedJobs = recentJobsWithUrls.filter((job) => job.status === 'completed');
      if (completedJobs.length > 0) {
        const totalDuration = completedJobs.reduce((total, job) => {
          const duration = new Date(job.updated_at) - new Date(job.created_at);
          return total + Math.max(0, duration / 1000 / 60);
        }, 0);
        const average = totalDuration / completedJobs.length;
        state.avgDuration = average < 1 ? "1 dk altı" : `${average.toFixed(1)} dk`;
      } else {
        state.avgDuration = "-";
      }

      const finishedJobs = recentJobsWithUrls.filter((job) => ['completed', 'approved', 'failed', 'failed_dispatch'].includes(job.status));
      if (finishedJobs.length > 0) {
        const successfulJobs = finishedJobs.filter((job) => ['completed', 'approved'].includes(job.status)).length;
        state.brandMatch = `${Math.round((successfulJobs / finishedJobs.length) * 100)}%`;
      } else {
        state.brandMatch = "-";
      }

      const latestJob = recentJobsWithUrls.find((job) => job.status !== 'approved') || recentJobsWithUrls[0];
      if (latestJob) {
        const brand = state.brands.find((item) => item.id === latestJob.brand_id);
        state.currentJob = {
          id: latestJob.id,
          title: titleFor(latestJob.brief_text, latestJob.format),
          brand: brand?.name || "Bilinmeyen",
          brandId: latestJob.brand_id,
          format: latestJob.format,
          dimensions: dimensionsFor(latestJob.format),
          status: latestJob.status,
          imageUrl: latestJob.signedImageUrl,
          brief: latestJob.brief_text,
          briefJson: latestJob.brief_json || {},
          timeline: latestJob.brief_json?.timeline || ["pending", latestJob.status].filter(Boolean),
          revisionCount: latestJob.revision_count || 0,
          revisionNote: latestJob.revision_note || "",
          lastError: latestJob.last_error || "",
          retryCount: latestJob.retry_count || 0,
          maxRetries: latestJob.max_retries || 3,
          nextRetryAt: latestJob.next_retry_at || ""
        };
      } else {
        state.currentJob = null;
      }

      state.assets = assetJobsWithUrls.map((job) => {
        const brand = state.brands.find((item) => item.id === job.brand_id);
        return {
          id: job.id,
          title: titleFor(job.brief_text, job.format),
          brand: brand?.name || "Bilinmeyen",
          format: job.format,
          dimensions: dimensionsFor(job.format),
          status: job.status,
          imageUrl: job.signedImageUrl
        };
      });

      state.history = historyJobs.map((job) => ({
        id: job.id,
        brief: job.brief_text,
        format: job.format,
        status: job.status,
        time: new Date(job.created_at).toLocaleString('tr-TR')
      }));

      populateBrandSelect();
      setLoadFeedback(
        assetLoadFailures.size ? `${assetLoadFailures.size} görsel için güvenli önizleme bağlantısı alınamadı. Yeniden deneyebilirsiniz.` : "",
        assetLoadFailures.size ? "warning" : "error"
      );
      return true;
    } catch (err) {
      if (requestId === dataRequestId) {
        console.error("Dashboard veri çekme hatası:", err);
        setLoadFeedback(getLoadErrorMessage(err), "error");
      }
      return false;
    } finally {
      if (requestId === dataRequestId) setPageLoading(false);
    }
  }

  function populateBrandSelect() {
    const select = document.querySelector("#briefBrand");
    if (!select) return;
    const currentSelection = select.value;
    select.replaceChildren();

    if (!state.brands.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Kullanılabilir marka bulunamadı";
      option.disabled = true;
      option.selected = true;
      select.append(option);
      return;
    }

    state.brands.forEach((brand) => {
      const option = document.createElement("option");
      option.value = brand.id;
      option.textContent = brand.name;
      select.append(option);
    });
    if (state.brands.some(b => b.id === currentSelection)) {
      select.value = currentSelection;
    } else {
      select.value = state.brands[0].id;
    }
  }

  function renderBrandContext() {
    const activeBrandId = document.querySelector("#briefBrand")?.value;
    const brand = state.brands.find((item) => item.id === activeBrandId) || state.brands[0];

    if (appContextBrand) appContextBrand.textContent = brand?.name || "Marka seçilmedi";
    if (settingsBrandTitle) settingsBrandTitle.textContent = brand ? `${brand.name} kuralları` : "Seçili marka kuralları";

    if (settingsToneRule) {
      const toneValue = Array.isArray(brand?.toneRules)
        ? brand.toneRules.join(", ")
        : typeof brand?.toneRules === "object" && brand?.toneRules
          ? Object.values(brand.toneRules).filter(Boolean).join(", ")
          : String(brand?.toneRules || "").trim();
      settingsToneRule.textContent = toneValue
        ? `Marka tonu: ${toneValue.slice(0, 140)}${toneValue.length > 140 ? "…" : ""}`
        : "Marka tonu için kayıtlı ek kural bulunmuyor";
    }

    if (settingsBannedWords) {
      const bannedWordCount = Array.isArray(brand?.bannedWords) ? brand.bannedWords.length : 0;
      settingsBannedWords.textContent = bannedWordCount
        ? `${bannedWordCount} yasaklı ifade üretim sırasında denetlenir`
        : "Bu marka için kayıtlı yasaklı ifade bulunmuyor";
    }
  }

  function statusLabel(status) {
    const labels = {
      active: "Aktif",
      inactive: "Pasif",
      new: "Yeni",
      reviewed: "İncelendi",
      approved: "Onaylandı",
      rejected: "Reddedildi",
      ...window.VitrinOS.config.defaults.statuses.labels
    };
    return labels[status] || status;
  }

  function setStatus(element, message, kind) {
    if (!element) return;
    element.textContent = message;
    if (kind) {
      element.dataset.kind = kind;
    } else {
      element.removeAttribute("data-kind");
    }
  }

  // Arayüz sekmeleri
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

  function detectFormat(text, selectedFormat) {
    if (selectedFormat && selectedFormat !== "auto") return selectedFormat;

    const normalized = text.toLocaleLowerCase("tr-TR");
    if (formatConfig.story.keywords.some((keyword) => normalized.includes(keyword))) return formatConfig.story.name;
    if (formatConfig.banner.keywords.some((keyword) => normalized.includes(keyword))) return formatConfig.banner.name;
    return formatConfig.metaPost.name;
  }

  function dimensionsFor(format) {
    return Object.values(formatConfig).find((item) => item.name === format)?.dimensions || formatConfig.metaPost.dimensions;
  }

  function titleFor(text, format) {
    const normalized = text.toLocaleLowerCase("tr-TR");
    if (normalized.includes("teknoloji") || normalized.includes("elektronik")) return "Teknoloji haftası";
    if (normalized.includes("moda") || normalized.includes("ayakkabı")) return "Yeni sezon";
    if (normalized.includes("ev") || normalized.includes("dekorasyon")) return "Evde yenileme";
    return format === "Story" ? "Mobil kampanya" : "Kampanya vitrini";
  }

  function renderMetrics() {
    metricJobs.textContent = String(state.jobsToday);
    metricApprovals.textContent = String(state.approvals);
    if (metricDuration) metricDuration.textContent = state.avgDuration;
    if (metricMatch) metricMatch.textContent = state.brandMatch;

    if (appContextUser && authContext && authContext.user) {
      appContextUser.textContent = authContext.user.email;
    }
    renderBrandContext();

    // Pipeline listesini dinamik olarak güncelle
    if (state.currentJob) {
      activeJobTitle.textContent = state.currentJob.title;
      pipelineCurrent.textContent =
        state.currentJob.status === "approved" ? "Final çıktı hazır" : 
        state.currentJob.status === "completed" ? "Önizleme hazır" : statusLabel(state.currentJob.status);

      if (state.currentJob.status === "revision_requested") {
        pipelineCurrent.textContent = "Revizyon hazırlanıyor";
      }

      if (pipelineList) {
        const steps = pipelineList.querySelectorAll("span");
        steps.forEach(step => {
          step.className = ""; // Sınıfları temizle
          const stepName = step.dataset.step;

          if (stepName === "parsed") {
            if (["pending", "processing", "completed", "approved", "revision_requested", "pending_retry"].includes(state.currentJob.status)) {
              step.classList.add("is-done");
            }
          } else if (stepName === "format") {
            if (["processing", "completed", "approved", "revision_requested", "pending_retry"].includes(state.currentJob.status)) {
              step.classList.add("is-done");
            }
          } else if (stepName === "current") {
            if (["pending", "processing", "revision_requested", "pending_retry"].includes(state.currentJob.status)) {
              step.classList.add("is-current");
              step.textContent = state.currentJob.status === "processing"
                ? "Üretiliyor…"
                : state.currentJob.status === "revision_requested"
                  ? "Revizyon hazırlanıyor…"
                : state.currentJob.status === "pending_retry"
                  ? "Yeniden bağlantı kuruluyor…"
                  : "İşleme alındı";
            } else if (state.currentJob.status === "completed") {
              step.classList.add("is-done");
              step.textContent = "Önizleme hazır";
            } else if (state.currentJob.status === "approved") {
              step.classList.add("is-done");
              step.textContent = "Final çıktı hazır";
            } else if (["failed", "failed_dispatch"].includes(state.currentJob.status)) {
              step.classList.add("is-current");
              step.textContent = "Müdahale gerekiyor";
            }
          } else if (stepName === "approval") {
            if (state.currentJob.status === "completed") {
              step.classList.add("is-current");
            } else if (state.currentJob.status === "approved") {
              step.classList.add("is-done");
            }
          }
        });
      }
    } else {
      activeJobTitle.textContent = "Aktif üretim yok";
      pipelineCurrent.textContent = "Brief bekliyor";
      if (pipelineList) {
        const steps = pipelineList.querySelectorAll("span");
        steps.forEach(step => {
          step.className = "";
          if (step.dataset.step === "current") {
            step.textContent = "Brief bekliyor";
            step.classList.add("is-current");
          }
        });
      }
    }

    // Format barlarını güncelle
    renderFormatBars();
  }

  function setResultActionAvailability(job) {
    const canReview = job?.status === "completed";
    if (approveButton) {
      approveButton.hidden = !canReview;
      approveButton.disabled = !canReview;
      approveButton.setAttribute("aria-disabled", String(!canReview));
    }
    if (reviseButton) {
      reviseButton.hidden = !canReview;
      reviseButton.disabled = !canReview;
      reviseButton.setAttribute("aria-disabled", String(!canReview));
    }
    if (!canReview && revisionBox) revisionBox.hidden = true;
    return canReview;
  }

  function renderResult() {
    const job = state.currentJob;
    const resultPanel = document.querySelector("#briefResult");
    const canReview = setResultActionAvailability(job);

    // Eger durum pending_retry degilse zamanlayiciyi temizle
    if (!job || job.status !== 'pending_retry') {
      if (activeRetryTimeoutId) {
        clearTimeout(activeRetryTimeoutId);
        activeRetryTimeoutId = null;
      }
    }

    // Yüklenme durumunu otomatik kontrol et
    if (job && (job.status === 'pending' || job.status === 'processing' || job.status === 'revision_requested' || job.status === 'pending_retry')) {
      setLoading(true);
      if (job.status === 'revision_requested') {
        briefSubmit.textContent = "Revizyon hazırlanıyor...";
      } else if (job.status === 'pending_retry') {
        briefSubmit.textContent = "Yeniden denenecek...";
      } else {
        briefSubmit.textContent = "Önizleme hazırlanıyor...";
      }
    } else {
      setLoading(false);
      // Görsel üretimi başarıyla tamamlandığında veya onaylandığında bekleme mesajlarını temizle
      if (job && (job.status === 'completed' || job.status === 'approved')) {
        const currentText = briefStatus ? briefStatus.textContent : "";
        if (
          currentText.includes("bekleniyor") || 
          currentText.includes("başladı") || 
          currentText.includes("tetikleniyor") || 
          currentText.includes("kaydediliyor")
        ) {
          setStatus(briefStatus, "");
        }
      }
    }

    if (job && job.status === 'failed_dispatch') {
      if (approveButton) approveButton.hidden = true;
      if (reviseButton) reviseButton.hidden = true;
      if (revisionBox) revisionBox.hidden = true;

      if (resultPanel) resultPanel.style.opacity = "1";
      resultTitle.textContent = "Bağlantı Hatası";
      resultBrand.textContent = "-";
      resultHeadline.textContent = "Tetikleme Başarısız";
      resultMeta.textContent = `${job.format} · ${statusLabel(job.status)}`;
      resultCreative.dataset.format = job.format.toLowerCase().replace(" ", "-");
      resultCreative.dataset.status = job.status;

      resultCreative.replaceChildren();

      const errorContainer = document.createElement("div");
      errorContainer.className = "creative-error-container";
      errorContainer.style.display = "flex";
      errorContainer.style.flexDirection = "column";
      errorContainer.style.alignItems = "center";
      errorContainer.style.justifyContent = "center";
      errorContainer.style.height = "100%";
      errorContainer.style.padding = "2rem";
      errorContainer.style.textAlign = "center";
      errorContainer.style.color = "var(--error, #e53e3e)";

      const errorIcon = document.createElement("span");
      errorIcon.textContent = "📡";
      errorIcon.style.fontSize = "3rem";
      errorIcon.style.marginBottom = "1rem";

      const errorTitle = document.createElement("strong");
      errorTitle.textContent = "Kreatif Üretim Hattı Başlatılamadı";
      errorTitle.style.display = "block";
      errorTitle.style.fontSize = "1.1rem";
      errorTitle.style.marginBottom = "0.5rem";

      const errorMsg = document.createElement("p");
      errorMsg.textContent = job.lastError || "Otomasyon webhook'u çağrılırken bir ağ hatası oluştu.";
      errorMsg.style.fontSize = "0.9rem";
      errorMsg.style.color = "var(--muted)";
      errorMsg.style.maxWidth = "80%";
      errorMsg.style.margin = "0 auto 1.5rem auto";

      const retryBtn = document.createElement("button");
      retryBtn.className = "button primary compact-button";
      retryBtn.textContent = "Yeniden Dene";
      retryBtn.type = "button";
      retryBtn.addEventListener("click", async () => {
        try {
          setStatus(briefStatus, "Yeniden tetikleniyor...");
          setLoading(true);
          await triggerBriefWorkflow({
            jobId: job.id,
            isRevision: job.revisionCount > 0
          });
          setStatus(briefStatus, "Yeniden tetikleme başarılı. Akış başlatıldı.");
          await fetchData();
        } catch (err) {
          console.error(err);
          setStatus(briefStatus, "Yeniden deneme başarısız: " + err.message, "error");
          setLoading(false);
        }
      });

      errorContainer.append(errorIcon, errorTitle, errorMsg, retryBtn);
      resultCreative.append(errorContainer);

      const creativeDetailsBox = document.querySelector("#creativeDetailsBox");
      if (creativeDetailsBox) {
        creativeDetailsBox.replaceChildren();
        creativeDetailsBox.hidden = true;
      }
      return;
    }

    if (job && job.status === 'pending_retry') {
      if (approveButton) approveButton.hidden = true;
      if (reviseButton) reviseButton.hidden = true;
      if (revisionBox) revisionBox.hidden = true;

      if (resultPanel) resultPanel.style.opacity = "1";
      resultTitle.textContent = "Bağlantı Kesintisi";
      resultBrand.textContent = "-";
      resultHeadline.textContent = "Yeniden Tetiklenecek...";
      resultMeta.textContent = `${job.format} · ${statusLabel(job.status)}`;
      resultCreative.dataset.format = job.format.toLowerCase().replace(" ", "-");
      resultCreative.dataset.status = job.status;

      resultCreative.replaceChildren();

      const retryContainer = document.createElement("div");
      retryContainer.className = "creative-retry-container";
      retryContainer.style.display = "flex";
      retryContainer.style.flexDirection = "column";
      retryContainer.style.alignItems = "center";
      retryContainer.style.justifyContent = "center";
      retryContainer.style.height = "100%";
      retryContainer.style.padding = "2rem";
      retryContainer.style.textAlign = "center";
      retryContainer.style.color = "var(--primary, #d9962a)";

      const retryIcon = document.createElement("span");
      retryIcon.textContent = "⏳";
      retryIcon.className = "loading-spinner";
      retryIcon.style.fontSize = "3rem";
      retryIcon.style.marginBottom = "1rem";

      const retryTitle = document.createElement("strong");
      retryTitle.textContent = "Ağ Hatası Alındı, Yeniden Tetiklenecek";
      retryTitle.style.display = "block";
      retryTitle.style.fontSize = "1.1rem";
      retryTitle.style.marginBottom = "0.5rem";

      const nextRetryDate = new Date(job.nextRetryAt);
      const remainingSeconds = Math.max(0, Math.ceil((nextRetryDate.getTime() - Date.now()) / 1000));
      
      const retryMsg = document.createElement("p");
      retryMsg.textContent = `Otomasyon hattına bağlanırken hata alındı (${job.lastError || "Ağ hatası"}). ${remainingSeconds} saniye içinde otomatik olarak tekrar denenecek (Deneme #${job.retryCount}/${job.maxRetries}).`;
      retryMsg.style.fontSize = "0.9rem";
      retryMsg.style.color = "var(--muted)";
      retryMsg.style.maxWidth = "80%";
      retryMsg.style.margin = "0 auto 1.5rem auto";

      const manualRetryBtn = document.createElement("button");
      manualRetryBtn.className = "button secondary compact-button";
      manualRetryBtn.textContent = "Hemen Yeniden Dene";
      manualRetryBtn.type = "button";
      manualRetryBtn.style.marginTop = "0.5rem";
      manualRetryBtn.addEventListener("click", async () => {
        try {
          setStatus(briefStatus, "Hemen yeniden tetikleniyor...");
          setLoading(true);
          await triggerBriefWorkflow({
            jobId: job.id,
            isRevision: job.revisionCount > 0
          });
          setStatus(briefStatus, "Yeniden tetikleme başarılı.");
          await fetchData();
        } catch (err) {
          console.error(err);
          setStatus(briefStatus, "Tetikleme başarısız: " + err.message, "error");
          setLoading(false);
        }
      });

      retryContainer.append(retryIcon, retryTitle, retryMsg, manualRetryBtn);
      resultCreative.append(retryContainer);

      const creativeDetailsBox = document.querySelector("#creativeDetailsBox");
      if (creativeDetailsBox) {
        creativeDetailsBox.replaceChildren();
        creativeDetailsBox.hidden = true;
      }
      
      // Auto retry baslat
      handlePendingRetryAutoTrigger(job);
      return;
    }

    if (job && job.status === 'failed') {
      if (approveButton) approveButton.hidden = true;
      if (reviseButton) reviseButton.hidden = true;
      if (revisionBox) revisionBox.hidden = true;

      if (resultPanel) resultPanel.style.opacity = "1";
      resultTitle.textContent = job.title;
      resultBrand.textContent = job.brand;
      resultHeadline.textContent = "Üretim Başarısız Oldu";
      resultMeta.textContent = `${job.format} · ${statusLabel(job.status)}`;
      resultCreative.dataset.format = job.format.toLowerCase().replace(" ", "-");
      resultCreative.dataset.status = job.status;

      resultCreative.replaceChildren();

      const errorContainer = document.createElement("div");
      errorContainer.className = "creative-error-container";
      errorContainer.style.display = "flex";
      errorContainer.style.flexDirection = "column";
      errorContainer.style.alignItems = "center";
      errorContainer.style.justifyContent = "center";
      errorContainer.style.height = "100%";
      errorContainer.style.padding = "2rem";
      errorContainer.style.textAlign = "center";
      errorContainer.style.color = "var(--error, #e53e3e)";

      const errorIcon = document.createElement("span");
      errorIcon.textContent = "⚠️";
      errorIcon.style.fontSize = "3rem";
      errorIcon.style.marginBottom = "1rem";

      const errorTitle = document.createElement("strong");
      errorTitle.textContent = "Yapay Zeka Görsel Üretimi Sırasında Hata Oluştu";
      errorTitle.style.display = "block";
      errorTitle.style.fontSize = "1.1rem";
      errorTitle.style.marginBottom = "0.5rem";

      const errorMsg = document.createElement("p");
      errorMsg.textContent = getFriendlyErrorMessage(job.revisionNote);
      errorMsg.style.fontSize = "0.9rem";
      errorMsg.style.color = "var(--muted)";
      errorMsg.style.maxWidth = "80%";
      errorMsg.style.margin = "0 auto";

      errorContainer.append(errorIcon, errorTitle, errorMsg);
      resultCreative.append(errorContainer);

      const creativeDetailsBox = document.querySelector("#creativeDetailsBox");
      if (creativeDetailsBox) {
        creativeDetailsBox.replaceChildren();
        creativeDetailsBox.hidden = true;
      }
      return;
    }

    if (!job) {
      if (resultPanel) resultPanel.style.opacity = "0.5";
      resultTitle.textContent = "Kreatif Hazırlanıyor";
      resultBrand.textContent = "-";
      resultHeadline.textContent = "Brief Girişi Bekleniyor";
      resultMeta.textContent = "Kreatif alan boş";
      resultCreative.removeAttribute("data-format");
      resultCreative.removeAttribute("data-status");
      resultCreative.replaceChildren();
      
      if (approveButton) approveButton.hidden = true;
      if (reviseButton) reviseButton.hidden = true;
      if (revisionBox) revisionBox.hidden = true;

      const creativeDetailsBox = document.querySelector("#creativeDetailsBox");
      if (creativeDetailsBox) {
        creativeDetailsBox.replaceChildren();
        creativeDetailsBox.hidden = true;
      }
      return;
    }

    if (approveButton) approveButton.hidden = !canReview;
    if (reviseButton) reviseButton.hidden = !canReview;

    if (resultPanel) resultPanel.style.opacity = "1";
    resultTitle.textContent = job.title;
    resultBrand.textContent = job.brand;
    resultHeadline.textContent = `${job.format} önizleme`;
    resultMeta.textContent = `${job.format} · ${job.dimensions} · ${statusLabel(job.status)}`;
    resultCreative.dataset.format = job.format.toLowerCase().replace(" ", "-");
    resultCreative.dataset.status = job.status;

    resultCreative.replaceChildren();
    if (job.imageUrl) {
      const img = document.createElement("img");
      img.src = job.imageUrl;
      img.alt = `${job.format} önizlemesi`;
      img.className = "result-creative-img";
      img.decoding = "async";
      resultCreative.append(img);
    } else {
      const brand = createTextElement("span", job.brand);
      const headline = createTextElement("strong", job.title);
      const meta = createTextElement("small", `${job.format} hazırlanıyor`);
      resultCreative.append(brand, headline, meta);
    }

    // Kreatif detay kutusunu güncelle
    const creativeDetailsBox = document.querySelector("#creativeDetailsBox");
    if (creativeDetailsBox) {
      if ((job.status === 'completed' || job.status === 'approved') && job.briefJson && job.briefJson.visual_details) {
        const details = job.briefJson.visual_details;
        const prices = details.prices || {};
        const campaign = details.campaign || {};

        const title = createTextElement("span", "Üretilen Kreatif Detayları");
        title.style.color = "var(--accent-soft)";
        title.style.fontFamily = "var(--font-mono)";
        title.style.fontSize = "0.76rem";
        title.style.fontWeight = "800";
        title.style.letterSpacing = "0.12em";
        title.style.textTransform = "uppercase";

        const grid = document.createElement("div");
        grid.style.display = "grid";
        grid.style.gridTemplateColumns = "1fr 1fr";
        grid.style.gap = "12px";
        grid.style.fontSize = "0.9rem";
        grid.style.marginTop = "8px";

        grid.append(
          createDetailItem("Ürün Adı:", details.product_name),
          createDetailItem("Kategori:", details.category),
          createDetailItem("Slogan:", details.slogan, { spanTwo: true })
        );

        if (prices.new_price || prices.old_price) {
          const discount = prices.discount_rate ? ` (%${prices.discount_rate} İndirim)` : "";
          grid.append(
            createDetailItem("Eski Fiyat:", prices.old_price),
            createDetailItem("Yeni Fiyat:", `${prices.new_price || "-"}${discount}`, { accent: true })
          );
        }

        if (campaign.campaign_name) {
          const code = campaign.campaign_code ? ` (Kod: ${campaign.campaign_code})` : "";
          grid.append(createDetailItem("Kampanya:", `${campaign.campaign_name}${code}`, { spanTwo: true }));
        }

        creativeDetailsBox.replaceChildren(title, grid);
        creativeDetailsBox.hidden = false;
      } else {
        creativeDetailsBox.replaceChildren();
        creativeDetailsBox.hidden = true;
      }
    }

    // Revizyon limit kontrolü
    if (!canReview) {
      reviseButton.disabled = true;
      reviseButton.setAttribute("aria-disabled", "true");
      reviseButton.textContent = "Revize et";
      reviseButton.title = "Revizyon yalnızca önizleme hazır olduğunda kullanılabilir.";
      return;
    }

    const revisionLimitReached = (job.revisionCount >= dashboardConfig.revisionLimit);
    if (revisionLimitReached) {
      reviseButton.disabled = true;
      reviseButton.setAttribute("aria-disabled", "true");
      reviseButton.textContent = `Limit ulaşıldı (${dashboardConfig.revisionLimit}/${dashboardConfig.revisionLimit})`;
      reviseButton.title = "Maksimum revizyon limitine ulaşıldı.";
    } else {
      reviseButton.disabled = false;
      reviseButton.setAttribute("aria-disabled", "false");
      reviseButton.textContent = "Revize et";
      reviseButton.title = "";
    }
  }

  function createAssetCard(asset) {
    const card = document.createElement("article");
    card.className = "asset-card";

    const preview = document.createElement("div");
    preview.className = "asset-preview";
    preview.dataset.format = asset.format.toLowerCase().replace(" ", "-");

    if (asset.imageUrl) {
      const img = document.createElement("img");
      img.src = asset.imageUrl;
      img.alt = asset.title;
      img.loading = "lazy";
      img.decoding = "async";
      preview.appendChild(img);
    } else {
      const brand = document.createElement("span");
      brand.textContent = asset.brand;
      const headline = document.createElement("strong");
      headline.textContent = asset.title;
      preview.append(brand, headline);
    }

    const meta = document.createElement("div");
    meta.className = "asset-meta";

    const title = document.createElement("strong");
    title.textContent = asset.format;
    const dimensions = document.createElement("span");
    dimensions.textContent = asset.dimensions;
    const status = document.createElement("em");
    status.textContent = statusLabel(asset.status);

    meta.append(title, dimensions, status);
    card.append(preview, meta);
    return card;
  }

  function renderAssets() {
    assetGrid.replaceChildren();
    if (!state.assets.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = state.assetPage > 0
        ? "Bu görsel sayfasında kayıt bulunmuyor. Önceki sayfaya dönebilirsiniz."
        : "Henüz görsel yok. Brief masasından ilk üretimi başlatın.";
      assetGrid.append(empty);
    } else {
      state.assets.forEach((asset) => assetGrid.append(createAssetCard(asset)));
    }
    renderJobPager(assetGrid, "assets");
  }

  function createHistoryItem(item) {
    const row = document.createElement("article");
    row.className = "history-item";

    const content = document.createElement("div");
    const brief = document.createElement("strong");
    brief.textContent = item.brief;
    const meta = document.createElement("span");
    meta.textContent = `${item.format} · ${item.time}`;
    content.append(brief, meta);

    const status = document.createElement("em");
    status.textContent = statusLabel(item.status);
    status.dataset.status = item.status;

    row.append(content, status);
    return row;
  }

  function renderHistory() {
    historyList.replaceChildren();
    if (!state.history.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = state.historyPage > 0
        ? "Bu geçmiş sayfasında kayıt bulunmuyor. Önceki sayfaya dönebilirsiniz."
        : "Henüz brief geçmişi yok.";
      historyList.append(empty);
    } else {
      state.history.forEach((item) => historyList.append(createHistoryItem(item)));
    }
    renderJobPager(historyList, "history");
  }

  function renderJobPager(container, kind) {
    const isAssets = kind === "assets";
    const currentPage = isAssets ? state.assetPage : state.historyPage;
    const hasMore = isAssets ? state.hasMoreAssets : state.hasMoreHistory;
    const pager = document.createElement('div');
    pager.className = 'list-pager';
    pager.setAttribute('aria-label', isAssets ? 'Görsel arşivi sayfalama' : 'Geçmiş kayıtları sayfalama');
    const pageLabel = document.createElement('span');
    pageLabel.textContent = `${isAssets ? 'Görsel arşivi' : 'Geçmiş'} · Sayfa ${currentPage + 1}`;
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.textContent = 'Önceki';
    previous.disabled = currentPage === 0;
    const next = document.createElement('button');
    next.type = 'button';
    next.textContent = 'Sonraki';
    next.disabled = !hasMore;
    const changePage = async (delta) => {
      const nextPage = Math.max(0, currentPage + delta);
      if (isAssets) state.assetPage = nextPage;
      else state.historyPage = nextPage;
      const loaded = await fetchData();
      if (!loaded) {
        if (isAssets) state.assetPage = currentPage;
        else state.historyPage = currentPage;
      }
      renderAll();
    };
    previous.addEventListener('click', () => changePage(-1));
    next.addEventListener('click', () => changePage(1));
    pager.append(pageLabel, previous, next);
    container.append(pager);
  }

  function renderAll() {
    renderMetrics();
    renderResult();
    renderAssets();
    renderHistory();
  }

  function setLoading(isLoading) {
    briefSubmit.disabled = isLoading;
    briefSubmit.textContent = isLoading ? "Önizleme hazırlanıyor..." : "Üretimi başlat";
    resultCreative.classList.toggle("is-loading", isLoading);
  }

  logoutButtons.forEach((button) => {
    button.addEventListener("click", () => window.VitrinOS.auth.signOut("login.html"));
  });

  appMenuToggle?.addEventListener("click", () => {
    if (appShell.classList.contains("menu-open")) closeAppMenu({ restoreFocus: true });
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
      target.focus();
      activateTab(target.dataset.tab);
    });
  });

  window.addEventListener("resize", () => closeAppMenu());

  closeAppMenu();

  document.querySelector("#briefBrand")?.addEventListener("change", renderBrandContext);

  dashboardRetryButton?.addEventListener("click", async () => {
    const loaded = await fetchData();
    if (loaded) renderAll();
  });

  briefForm.addEventListener("submit", async (event) => {
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

    setStatus(briefStatus, "Brief Supabase veritabanına kaydediliyor...");
    setLoading(true);

    const format = detectFormat(brief, formData.get("format"));
    const sourceImage = sourceImageInput?.files?.[0] || null;
    let sourceImagePath = "";
    let jobCreated = false;

    try {
      if (sourceImage) {
        setStatus(briefStatus, "Ürün görseli güvenli Storage alanına yükleniyor...");
        sourceImagePath = await uploadSourceImage(sourceImage, brandId);
      }

      // 1. Supabase'e pending job insert et
      const { data: newJob, error: jErr } = await client
        .from('jobs')
        .insert({
          user_id: authContext.user.id,
          brand_id: brandId,
          brief_text: brief,
          format: format,
          status: 'pending',
          source_image_path: sourceImagePath || null
        })
        .select('id')
        .single();

      if (jErr) throw jErr;
      jobCreated = true;

      setStatus(briefStatus, "Kreatif üretim akışı (n8n) tetikleniyor...");

      // 2. n8n yalnizca authenticated Supabase Edge Function uzerinden tetiklenir.
      await triggerBriefWorkflow({
        jobId: newJob.id,
        isRevision: false
      });
      // 3. Local state'i yenile
      await fetchData();
      if (sourceImageInput) sourceImageInput.value = "";
      setLoading(false);
      setStatus(briefStatus, "Üretim akışı başladı. Supabase Realtime ile görsel hazır olduğunda otomatik güncellenecektir.");
      revisionBox.hidden = true;
      renderAll();
      activateTab("brief");

    } catch (err) {
      console.error(err);
      if (sourceImagePath && !jobCreated) {
        await client.storage.from("source-assets").remove([sourceImagePath]).catch(() => {});
      }
      setStatus(briefStatus, "Hata oluştu: " + err.message, "error");
      setLoading(false);
    }
  });

  approveButton.addEventListener("click", async () => {
    if (!state.currentJob || state.currentJob.status !== "completed") return;
    
    setStatus(briefStatus, "Onaylanıyor...");

    try {
      await runJobAction({
        action: "approve_job",
        jobId: state.currentJob.id
      });

      setStatus(briefStatus, "Çıktı başarıyla onaylandı ve arşive aktarıldı.");
      await fetchData();
      renderAll();
    } catch (err) {
      setStatus(briefStatus, "Onaylama hatası: " + err.message, "error");
    }
  });

  reviseButton.addEventListener("click", () => {
    if (!state.currentJob || state.currentJob.status !== "completed" || reviseButton.disabled) return;
    revisionBox.hidden = false;
    revisionText.focus();
    setStatus(briefStatus, "Revizyon notunu yazıp üretimi tekrar tetikleyin.");
  });

  sendRevisionButton.addEventListener("click", async (event) => {
    if (!state.currentJob || state.currentJob.status !== "completed") return;
    
    const note = revisionText.value.trim();

    if (note.length < dashboardConfig.revisionMinLength) {
      setStatus(briefStatus, "Revizyon notu biraz daha açık olmalı.", "error");
      return;
    }

    setLoading(true);
    setStatus(briefStatus, "Revizyon talebi kaydediliyor...");

    try {
      // 1. Durumu revision_requested olarak güncelle ve revizyon sayısını artır
      const { job: updatedJob } = await runJobAction({
        action: "request_job_revision",
        jobId: state.currentJob.id,
        revisionNote: note
      });

      setStatus(briefStatus, "Revizyon akışı (n8n) tetikleniyor...");

      // 2. Revizyon tetigi de public webhook yerine authenticated Edge Function'dan gecer.
      await triggerBriefWorkflow({
        jobId: updatedJob.id,
        isRevision: true
      });

      await fetchData();
      setLoading(false);
      revisionBox.hidden = true;
      revisionText.value = "";
      setStatus(briefStatus, "Revizyon talebi gönderildi. Yenilenen görsel bekleniyor.");
      renderAll();

    } catch (err) {
      console.error(err);
      setStatus(briefStatus, "Revizyon hatası: " + err.message, "error");
      setLoading(false);
    }
  });

  function setupRealtime() {
    const userFilter = `user_id=eq.${authContext.user.id}`;

    client
      .channel('public:jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: userFilter }, async (payload) => {
        console.log("Realtime dashboard jobs güncellemesi alındı:", payload);
        const loaded = await fetchData();
        if (loaded) renderAll();
      })
      .subscribe();

    client
      .channel('public:brands')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'brands', filter: userFilter }, async () => {
        const loaded = await fetchData();
        if (loaded) renderAll();
      })
      .subscribe();
  }

  // Başlangıç
  await fetchData();
  setupRealtime();
  renderAll();
})();

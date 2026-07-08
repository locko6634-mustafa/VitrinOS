(async function () {
  const authContext = await window.VitrinOS.auth.requireAuthenticated({
    redirectTo: "login.html"
  });

  if (!authContext) return;

  const client = window.VitrinOS.auth.getClient();

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

  const logoutButton = document.querySelector("#logoutButton");
  const tabButtons = Array.from(document.querySelectorAll("[data-tab]"));
  const panels = Array.from(document.querySelectorAll(".tab-panel"));
  const briefForm = document.querySelector("#briefForm");
  const briefStatus = document.querySelector("#briefStatus");
  const briefSubmit = document.querySelector("#briefSubmit");
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

  async function triggerBriefWorkflow(payload) {
    const functionName = window.VitrinOS.config.briefTriggerFunction || "trigger-brief";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 saniye timeout

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

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function escapeAttr(value) {
    return escapeHtml(value);
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

  // Supabase'den verileri çeken fonksiyon
  async function fetchData() {
    try {
      // 1. Markaları çek
      const { data: dbBrands, error: bErr } = await client
        .from('brands')
        .select('id,name,logo_url,website_url,color_palette,tone_rules,banned_words');
      if (bErr) throw bErr;

      // 2. Jobları çek (sadece kullanıcıya ait olanlar RLS ile gelir ama yine de filtreliyoruz)
      const { data: dbJobs, error: jErr } = await client
        .from('jobs')
        .select('id,user_id,brand_id,brief_text,format,status,image_url,revision_count,revision_note,brief_json,created_at,updated_at')
        .order('created_at', { ascending: false });
      if (jErr) throw jErr;

      const jobsWithAssetUrls = await Promise.all(dbJobs.map(async (job) => {
        let signedImageUrl = "";
        try {
          signedImageUrl = await window.VitrinOS.storage.getGeneratedAssetUrl(job.image_url);
        } catch (assetErr) {
          console.error("Görsel signed URL hatası:", assetErr);
        }
        return { ...job, signedImageUrl };
      }));

      // State normalizasyonu
      state.brands = dbBrands.map(b => ({
        id: b.id,
        name: b.name,
        logoUrl: b.logo_url || "",
        websiteUrl: b.website_url || "",
        primary: b.color_palette?.primary || "#d9962a",
        secondary: b.color_palette?.secondary || "#7a4f12",
        theme: b.color_palette?.theme || "koyu",
        toneRules: b.tone_rules || "",
        bannedWords: b.banned_words || []
      }));

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      state.jobsToday = jobsWithAssetUrls.filter(j => new Date(j.created_at) >= todayStart).length;

      // Onay bekleyen metrikleri (approved veya failed olmayan, tamamlanmış veya işlenen işler)
      state.approvals = jobsWithAssetUrls.filter(j => j.status !== 'approved' && j.status !== 'failed').length;

      // Ortalama Süre hesaplama (completed veya approved olan işler için)
      const completedJobs = jobsWithAssetUrls.filter(j => j.status === 'completed' || j.status === 'approved');
      if (completedJobs.length > 0) {
        const totalDuration = completedJobs.reduce((acc, j) => {
          const diff = new Date(j.updated_at) - new Date(j.created_at); // ms
          return acc + (diff / 1000 / 60); // minutes
        }, 0);
        const avg = totalDuration / completedJobs.length;
        state.avgDuration = avg < 1 ? "1 dk altı" : `${avg.toFixed(1)} dk`;
      } else {
        state.avgDuration = "-";
      }

      // Marka Uyumu hesaplama (failed olmayanların oranı)
      const totalJobsCount = jobsWithAssetUrls.length;
      if (totalJobsCount > 0) {
        const successJobs = jobsWithAssetUrls.filter(j => j.status !== 'failed').length;
        state.brandMatch = `${Math.round((successJobs / totalJobsCount) * 100)}%`;
      } else {
        state.brandMatch = "-";
      }

      const lastJob = jobsWithAssetUrls.find(j => j.status !== 'approved');
      if (lastJob) {
        const brand = state.brands.find(b => b.id === lastJob.brand_id);
        state.currentJob = {
          id: lastJob.id,
          title: titleFor(lastJob.brief_text, lastJob.format),
          brand: brand ? brand.name : "Bilinmeyen",
          brandId: lastJob.brand_id,
          format: lastJob.format,
          dimensions: dimensionsFor(lastJob.format),
          status: lastJob.status,
          imageUrl: lastJob.signedImageUrl,
          brief: lastJob.brief_text,
          briefJson: lastJob.brief_json || {},
          timeline: lastJob.brief_json?.timeline || ["pending", lastJob.status].filter(Boolean),
          revisionCount: lastJob.revision_count || 0,
          revisionNote: lastJob.revision_note || ""
        };
      } else {
        state.currentJob = null;
      }

      state.assets = jobsWithAssetUrls.filter(j => j.status === 'approved' || j.status === 'completed').map(j => {
        const brand = state.brands.find(b => b.id === j.brand_id);
        return {
          id: j.id,
          title: titleFor(j.brief_text, j.format),
          brand: brand ? brand.name : "Bilinmeyen",
          format: j.format,
          dimensions: dimensionsFor(j.format),
          status: j.status,
          imageUrl: j.signedImageUrl
        };
      });

      state.history = jobsWithAssetUrls.map(j => ({
        id: j.id,
        brief: j.brief_text,
        format: j.format,
        status: j.status,
        time: new Date(j.created_at).toLocaleString('tr-TR')
      }));

      populateBrandSelect();

    } catch (err) {
      console.error("Dashboard veri çekme hatası:", err);
    }
  }

  function populateBrandSelect() {
    const select = document.querySelector("#briefBrand");
    if (!select) return;
    const currentSelection = select.value;
    select.replaceChildren();
    state.brands.forEach((brand) => {
      const option = document.createElement("option");
      option.value = brand.id;
      option.textContent = brand.name;
      select.append(option);
    });
    if (state.brands.some(b => b.id === currentSelection)) {
      select.value = currentSelection;
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
      pending: "Pending",
      processing: "Processing",
      completed: "Completed",
      failed: "Failed",
      revision_requested: "Revizyon istendi"
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
    tabButtons.forEach((button) => {
      const isActive = button.dataset.tab === tabName;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });

    panels.forEach((panel) => {
      const isActive = panel.id === `panel-${tabName}`;
      panel.classList.toggle("is-active", isActive);
      panel.hidden = !isActive;
    });
  }

  function detectFormat(text, selectedFormat) {
    if (selectedFormat && selectedFormat !== "auto") return selectedFormat;

    const normalized = text.toLocaleLowerCase("tr-TR");
    if (normalized.includes("story") || normalized.includes("hikaye") || normalized.includes("9:16")) return "Story";
    if (normalized.includes("banner") || normalized.includes("1600") || normalized.includes("600")) return "Banner";
    return "Meta Post";
  }

  function dimensionsFor(format) {
    if (format === "Story") return "1080x1920";
    if (format === "Banner") return "1600x600";
    return "1080x1350";
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
    if (state.currentJob) {
      activeJobTitle.textContent = state.currentJob.title;
      pipelineCurrent.textContent =
        state.currentJob.status === "approved" ? "Final çıktı hazır" : 
        state.currentJob.status === "completed" ? "Önizleme hazır" : statusLabel(state.currentJob.status);
    } else {
      activeJobTitle.textContent = "Üretim yok";
      pipelineCurrent.textContent = "Brief bekliyor";
    }
  }

  function renderResult() {
    const job = state.currentJob;
    const resultPanel = document.querySelector("#briefResult");

    // Yüklenme durumunu otomatik kontrol et
    if (job && (job.status === 'pending' || job.status === 'processing' || job.status === 'revision_requested')) {
      setLoading(true);
      if (job.status === 'revision_requested') {
        briefSubmit.textContent = "Revizyon hazırlanıyor...";
      } else {
        briefSubmit.textContent = "Önizleme hazırlanıyor...";
      }
    } else {
      setLoading(false);
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

    if (approveButton) approveButton.hidden = false;
    if (reviseButton) reviseButton.hidden = false;

    if (resultPanel) resultPanel.style.opacity = "1";
    resultTitle.textContent = job.title;
    resultBrand.textContent = job.brand;
    resultHeadline.textContent = `${job.format} önizleme`;
    resultMeta.textContent = `${job.format} · ${job.dimensions} · ${statusLabel(job.status)}`;
    resultCreative.dataset.format = job.format.toLowerCase().replace(" ", "-");
    resultCreative.dataset.status = job.status;

    resultCreative.replaceChildren();
    if (job.imageUrl) {
      const hiddenBrand = document.createElement("span");
      hiddenBrand.id = "resultBrand";
      hiddenBrand.style.display = "none";
      hiddenBrand.textContent = job.brand;

      const img = document.createElement("img");
      img.src = job.imageUrl;
      img.alt = `${job.format} önizlemesi`;
      img.className = "result-creative-img";
      img.style.maxWidth = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      img.style.borderRadius = "6px";
      resultCreative.append(hiddenBrand, img);
    } else {
      const brand = createTextElement("span", job.brand);
      brand.id = "resultBrand";
      const headline = createTextElement("strong", job.title);
      headline.id = "resultHeadline";
      const meta = createTextElement("small", `${job.format} hazırlanıyor`);
      meta.id = "resultMeta";
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
    const revisionLimitReached = (job.revisionCount >= 3);
    if (revisionLimitReached) {
      reviseButton.disabled = true;
      reviseButton.textContent = "Limit ulaşıldı (3/3)";
      reviseButton.style.opacity = "0.5";
      reviseButton.title = "Maksimum revizyon limitine ulaşıldı.";
    } else {
      reviseButton.disabled = false;
      reviseButton.textContent = "Revize et";
      reviseButton.style.opacity = "1";
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
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      img.style.borderRadius = "6px";
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
      empty.textContent = "Henüz görsel yok. Brief sekmesinden ilk üretimi başlat.";
      assetGrid.append(empty);
      return;
    }
    state.assets.forEach((asset) => assetGrid.append(createAssetCard(asset)));
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
      empty.textContent = "Henüz brief geçmişi yok.";
      historyList.append(empty);
      return;
    }
    state.history.forEach((item) => historyList.append(createHistoryItem(item)));
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

  logoutButton.addEventListener("click", () => {
    window.VitrinOS.auth.signOut("login.html");
  });

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  });

  briefForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(briefForm);
    const brief = String(formData.get("brief") || "").trim();
    const brandId = formData.get("brand");

    if (brief.length < 12) {
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

    try {
      // 1. Supabase'e pending job insert et
      const { data: newJob, error: jErr } = await client
        .from('jobs')
        .insert({
          user_id: authContext.user.id,
          brand_id: brandId,
          brief_text: brief,
          format: format,
          status: 'pending'
        })
        .select('id')
        .single();

      if (jErr) throw jErr;

      setStatus(briefStatus, "Kreatif üretim akışı (n8n) tetikleniyor...");

      // 2. n8n yalnizca authenticated Supabase Edge Function uzerinden tetiklenir.
      await triggerBriefWorkflow({
        jobId: newJob.id,
        isRevision: false
      });
      // 3. Local state'i yenile
      await fetchData();
      setLoading(false);
      setStatus(briefStatus, "Üretim akışı başladı. Supabase Realtime ile görsel hazır olduğunda otomatik güncellenecektir.");
      revisionBox.hidden = true;
      renderAll();
      activateTab("brief");

    } catch (err) {
      console.error(err);
      setStatus(briefStatus, "Hata oluştu: " + err.message, "error");
      setLoading(false);
    }
  });

  approveButton.addEventListener("click", async () => {
    if (!state.currentJob) return;
    
    setStatus(briefStatus, "Onaylanıyor...");

    try {
      const { error } = await client.rpc('approve_job', {
        target_job_id: state.currentJob.id
      });

      if (error) throw error;

      setStatus(briefStatus, "Çıktı başarıyla onaylandı ve arşive aktarıldı.");
      await fetchData();
      renderAll();
    } catch (err) {
      setStatus(briefStatus, "Onaylama hatası: " + err.message, "error");
    }
  });

  reviseButton.addEventListener("click", () => {
    revisionBox.hidden = false;
    revisionText.focus();
    setStatus(briefStatus, "Revizyon notunu yazıp üretimi tekrar tetikleyin.");
  });

  sendRevisionButton.addEventListener("click", async (event) => {
    if (!state.currentJob) return;
    
    const note = revisionText.value.trim();

    if (note.length < 6) {
      setStatus(briefStatus, "Revizyon notu biraz daha açık olmalı.", "error");
      return;
    }

    setLoading(true);
    setStatus(briefStatus, "Revizyon talebi kaydediliyor...");

    try {
      // 1. Durumu revision_requested olarak güncelle ve revizyon sayısını artır
      const { data: updatedJob, error: uErr } = await client.rpc('request_job_revision', {
        target_job_id: state.currentJob.id,
        revision_note: note
      });

      if (uErr) throw uErr;

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
        await fetchData();
        renderAll();
      })
      .subscribe();

    client
      .channel('public:brands')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'brands', filter: userFilter }, async () => {
        await fetchData();
        renderAll();
      })
      .subscribe();
  }

  // Başlangıç
  await fetchData();
  setupRealtime();
  renderAll();
})();

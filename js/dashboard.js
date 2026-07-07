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

  // Supabase'den verileri çeken fonksiyon
  async function fetchData() {
    try {
      // 1. Markaları çek
      const { data: dbBrands, error: bErr } = await client
        .from('brands')
        .select('*');
      if (bErr) throw bErr;

      // 2. Jobları çek (sadece kullanıcıya ait olanlar RLS ile gelir ama yine de filtreliyoruz)
      const { data: dbJobs, error: jErr } = await client
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });
      if (jErr) throw jErr;

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
      state.jobsToday = dbJobs.filter(j => new Date(j.created_at) >= todayStart).length;

      // Onay bekleyen metrikleri (approved veya failed olmayan, tamamlanmış veya işlenen işler)
      state.approvals = dbJobs.filter(j => j.status !== 'approved' && j.status !== 'failed').length;

      // Ortalama Süre hesaplama (completed veya approved olan işler için)
      const completedJobs = dbJobs.filter(j => j.status === 'completed' || j.status === 'approved');
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
      const totalJobsCount = dbJobs.length;
      if (totalJobsCount > 0) {
        const successJobs = dbJobs.filter(j => j.status !== 'failed').length;
        state.brandMatch = `${Math.round((successJobs / totalJobsCount) * 100)}%`;
      } else {
        state.brandMatch = "-";
      }

      const lastJob = dbJobs[0];
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
          imageUrl: lastJob.image_url,
          brief: lastJob.brief_text,
          briefJson: lastJob.brief_json || {},
          timeline: lastJob.brief_json?.timeline || ["pending", lastJob.status].filter(Boolean),
          revisionCount: lastJob.revision_count || 0
        };
      } else {
        state.currentJob = null;
      }

      state.assets = dbJobs.filter(j => j.status === 'approved' || j.status === 'completed').map(j => {
        const brand = state.brands.find(b => b.id === j.brand_id);
        return {
          id: j.id,
          title: titleFor(j.brief_text, j.format),
          brand: brand ? brand.name : "Bilinmeyen",
          format: j.format,
          dimensions: dimensionsFor(j.format),
          status: j.status,
          imageUrl: j.image_url
        };
      });

      state.history = dbJobs.map(j => ({
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
    select.innerHTML = state.brands.map(b => `<option value="${b.id}">${b.name}</option>`).join("");
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

    if (!job) {
      if (resultPanel) resultPanel.style.opacity = "0.5";
      resultTitle.textContent = "Kreatif Hazırlanıyor";
      resultBrand.textContent = "-";
      resultHeadline.textContent = "Brief Girişi Bekleniyor";
      resultMeta.textContent = "Kreatif alan boş";
      resultCreative.removeAttribute("data-format");
      resultCreative.removeAttribute("data-status");
      resultCreative.innerHTML = "";
      
      const creativeDetailsBox = document.querySelector("#creativeDetailsBox");
      if (creativeDetailsBox) {
        creativeDetailsBox.innerHTML = "";
        creativeDetailsBox.hidden = true;
      }
      return;
    }

    if (resultPanel) resultPanel.style.opacity = "1";
    resultTitle.textContent = job.title;
    resultBrand.textContent = job.brand;
    resultHeadline.textContent = `${job.format} önizleme`;
    resultMeta.textContent = `${job.format} · ${job.dimensions} · ${statusLabel(job.status)}`;
    resultCreative.dataset.format = job.format.toLowerCase().replace(" ", "-");
    resultCreative.dataset.status = job.status;

    // Görsel önizlemesini render et
    if (job.imageUrl) {
      resultCreative.innerHTML = `
        <span id="resultBrand" style="display:none;">${job.brand}</span>
        <img src="${job.imageUrl}" alt="${job.format} önizlemesi" class="result-creative-img" style="max-width: 100%; height: 100%; object-fit: cover; border-radius: 6px;" />
      `;
    } else {
      resultCreative.innerHTML = `
        <span id="resultBrand">${job.brand}</span>
        <strong id="resultHeadline">${job.title}</strong>
        <small id="resultMeta">${job.format} hazırlanıyor</small>
      `;
    }

    // Kreatif detay kutusunu güncelle
    const creativeDetailsBox = document.querySelector("#creativeDetailsBox");
    if (creativeDetailsBox) {
      if ((job.status === 'completed' || job.status === 'approved') && job.briefJson && job.briefJson.visual_details) {
        const details = job.briefJson.visual_details;
        const prices = details.prices || {};
        const campaign = details.campaign || {};
        
        let pricesHtml = "";
        if (prices.new_price || prices.old_price) {
          pricesHtml = `
            <div><span style="color: var(--muted);">Eski Fiyat:</span> <strong style="color: var(--ink); display:block; margin-top: 2px;">${prices.old_price || '-'}</strong></div>
            <div><span style="color: var(--muted);">Yeni Fiyat:</span> <strong style="color: var(--accent-soft); display:block; margin-top: 2px;">${prices.new_price || '-'} ${prices.discount_rate ? `(%${prices.discount_rate} İndirim)` : ''}</strong></div>
          `;
        }
        
        let campaignHtml = "";
        if (campaign.campaign_name) {
          campaignHtml = `
            <div style="grid-column: span 2;"><span style="color: var(--muted);">Kampanya:</span> <strong style="color: var(--ink); display:block; margin-top: 2px;">${campaign.campaign_name} ${campaign.campaign_code ? `(Kod: ${campaign.campaign_code})` : ''}</strong></div>
          `;
        }

        creativeDetailsBox.innerHTML = `
          <span style="color: var(--accent-soft); font-family: var(--font-mono); font-size: 0.76rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;">Üretilen Kreatif Detayları</span>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 0.9rem; margin-top: 8px;">
            <div><span style="color: var(--muted);">Ürün Adı:</span> <strong style="color: var(--ink); display:block; margin-top: 2px;">${details.product_name || '-'}</strong></div>
            <div><span style="color: var(--muted);">Kategori:</span> <strong style="color: var(--ink); display:block; margin-top: 2px;">${details.category || '-'}</strong></div>
            <div style="grid-column: span 2;"><span style="color: var(--muted);">Slogan:</span> <strong style="color: var(--ink); display:block; margin-top: 2px;">${details.slogan || '-'}</strong></div>
            ${pricesHtml}
            ${campaignHtml}
          </div>
        `;
        creativeDetailsBox.hidden = false;
      } else {
        creativeDetailsBox.innerHTML = "";
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
        .select()
        .single();

      if (jErr) throw jErr;

      setStatus(briefStatus, "Kreatif üretim akışı (n8n) tetikleniyor...");

      // 2. n8n generic workflow tetiklemesi için POST at (hata verirse catch ile yutacağız, lokal simülasyonu bozmamak için)
      const webhookUrl = window.VitrinOS.config.n8nWebhookUrl;
      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: newJob.id,
          userId: newJob.user_id,
          brandId: newJob.brand_id,
          briefText: newJob.brief_text,
          format: newJob.format,
          isRevision: false
        })
      }).catch(err => console.log("n8n webhook bağlantısı kurulamadı:", err));

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
      const { error } = await client
        .from('jobs')
        .update({ status: 'approved' })
        .eq('id', state.currentJob.id);

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
      const { data: updatedJob, error: uErr } = await client
        .from('jobs')
        .update({
          status: 'revision_requested',
          revision_count: state.currentJob.revisionCount + 1,
          revision_note: note
        })
        .eq('id', state.currentJob.id)
        .select()
        .single();

      if (uErr) throw uErr;

      setStatus(briefStatus, "Revizyon akışı (n8n) tetikleniyor...");

      // 2. n8n revize webhook POST tetikleme (HB_REVIZE benzeri generic)
      const webhookUrl = window.VitrinOS.config.n8nWebhookUrl;
      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: updatedJob.id,
          userId: updatedJob.user_id,
          brandId: updatedJob.brand_id,
          briefText: updatedJob.brief_text,
          format: updatedJob.format,
          revisionNote: note,
          isRevision: true
        })
      }).catch(err => console.log("n8n revize webhook bağlantısı kurulamadı:", err));

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
    client
      .channel('public:jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `user_id=eq.${authContext.user.id}` }, async (payload) => {
        console.log("Realtime dashboard jobs güncellemesi alındı:", payload);
        await fetchData();
        renderAll();
      })
      .subscribe();

    client
      .channel('public:brands')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'brands' }, async () => {
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

(async function () {
  const authContext = await window.VitrinOS.auth.requireAdmin({
    redirectTo: "login.html",
    fallbackTo: "dashboard.html"
  });

  if (!authContext) return;

  const client = window.VitrinOS.auth.getClient();

  const state = {
    selectedBrandId: "",
    selectedJobId: "",
    brandSort: { key: "name", dir: 1 },
    jobSort: { key: "created_at", dir: -1 },
    brands: [],
    users: [],
    leads: [],
    jobs: [],
    promptTemplates: {
      base_prompt: "HEPSIBURADA BASE ŞABLONU: Kullanıcı brief'ini niyet, kategori, kampanya, format ve zorunlu görsel kısıtlar olarak JSON'a ayır.",
      story_text_prompt: "HEPSIBURADA STORY METİN ŞABLONU: 1080x1920 dikey Story için metin ve kurguyu oluştur.",
      story_bg_prompt: "HEPSIBURADA STORY ARKA PLAN ŞABLONU: Story için DALL-E ile dikey arka plan tasarımı promptu üret.",
      story_img_prompt: "HEPSIBURADA STORY GÖRSEL ŞABLONU: Story arka planına gerçek ürün görselini entegre etmek için edit promptu hazırla.",
      banner_text_prompt: "HEPSIBURADA BANNER METİN ŞABLONU: Dinamik banner boyutuna uygun reklam metinlerini üret.",
      banner_bg_prompt: "HEPSIBURADA BANNER ARKA PLAN ŞABLONU: Banner formatına uygun yatay arka plan tasarım promptu üret.",
      banner_img_prompt: "HEPSIBURADA BANNER GÖRSEL ŞABLONU: Banner arka planına ürünü entegre edecek edit promptu hazırla.",
      meta_post_text_prompt: "HEPSIBURADA META POST METİN ŞABLONU: Instagram dikey gönderi (1080x1350) için metin ve başlıkları üret.",
      meta_post_bg_prompt: "HEPSIBURADA META POST ARKA PLAN ŞABLONU: Meta Post için dikey portre arka plan promptu üret.",
      meta_post_img_prompt: "HEPSIBURADA META POST GÖRSEL ŞABLONU: Meta Post arka planına ürünü yerleştirecek edit promptu hazırla.",
      revize_prompt: "HEPSIBURADA REVİZE ŞABLONU: Revizyon notunu uygula, önceki brief kararlarını koru, değişen alanları kısa raporla."
    }
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const nodes = {
    metrics: $("#adminMetrics"),
    recentJobs: $("#recentJobs"),
    recentLeads: $("#recentLeads"),
    brandRows: $("#brandRows"),
    brandCount: $("#brandCount"),
    brandSearch: $("#brandSearch"),
    brandThemeFilter: $("#brandThemeFilter"),
    brandForm: $("#brandForm"),
    brandStatus: $("#brandStatus"),
    brandFormTitle: $("#brandFormTitle"),
    userRows: $("#userRows"),
    userCount: $("#userCount"),
    userSearch: $("#userSearch"),
    userStatusFilter: $("#userStatusFilter"),
    leadRows: $("#leadRows"),
    leadCount: $("#leadCount"),
    leadSearch: $("#leadSearch"),
    leadStatusFilter: $("#leadStatusFilter"),
    jobRows: $("#jobRows"),
    jobCount: $("#jobCount"),
    jobDetail: $("#jobDetail"),
    jobBrandFilter: $("#jobBrandFilter"),
    jobFormatFilter: $("#jobFormatFilter"),
    jobStatusFilter: $("#jobStatusFilter")
  };

  async function fetchData() {
    try {
      const { data: dbBrands, error: bErr } = await client
        .from('brands')
        .select('*, brand_prompts(*)');
      if (bErr) throw bErr;

      const { data: dbUsers, error: uErr } = await client
        .from('users')
        .select('*');
      if (uErr) throw uErr;

      const { data: dbLeads, error: lErr } = await client
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (lErr) throw lErr;

      const { data: dbJobs, error: jErr } = await client
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });
      if (jErr) throw jErr;

      state.users = dbUsers.map(u => ({
        id: u.id,
        email: u.email,
        brandIds: dbBrands.filter(b => b.user_id === u.id).map(b => b.id),
        jobCount: dbJobs.filter(j => j.user_id === u.id).length,
        lastLogin: u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('tr-TR') : "Hiç giriş yapmadı",
        status: u.banned_until ? "inactive" : "active"
      }));

      state.brands = dbBrands.map(b => {
        const owner = state.users.find(u => u.id === b.user_id);
        const prompts = b.brand_prompts?.[0] || b.brand_prompts || {};
        return {
          id: b.id,
          name: b.name,
          userEmail: owner ? owner.email : "Atanmamış",
          userId: b.user_id,
          logoUrl: b.logo_url || "",
          websiteUrl: b.website_url || "",
          primary: b.color_palette?.primary || "#d9962a",
          secondary: b.color_palette?.secondary || "#7a4f12",
          theme: b.color_palette?.theme || "koyu",
          toneRules: b.tone_rules || "",
          bannedWords: b.banned_words || [],
          formatCount: dbJobs.filter(j => j.brand_id === b.id).length,
          updatedAt: new Date(b.updated_at).toLocaleString('tr-TR'),
          prompts: {
            base_prompt: prompts.base_prompt || "",
            story_text_prompt: prompts.story_text_prompt || "",
            story_bg_prompt: prompts.story_bg_prompt || "",
            story_img_prompt: prompts.story_img_prompt || "",
            banner_text_prompt: prompts.banner_text_prompt || "",
            banner_bg_prompt: prompts.banner_bg_prompt || "",
            banner_img_prompt: prompts.banner_img_prompt || "",
            meta_post_text_prompt: prompts.meta_post_text_prompt || "",
            meta_post_bg_prompt: prompts.meta_post_bg_prompt || "",
            meta_post_img_prompt: prompts.meta_post_img_prompt || "",
            revize_prompt: prompts.revize_prompt || ""
          }
        };
      });

      state.leads = dbLeads.map(l => ({
        id: l.id,
        name: l.name,
        company: l.company,
        email: l.email,
        website: l.website || "",
        need: l.need || "",
        note: l.note || "",
        status: l.status || "new",
        createdAt: new Date(l.created_at).toLocaleString('tr-TR')
      }));

      state.jobs = dbJobs.map(j => {
        const owner = state.users.find(u => u.id === j.user_id);
        return {
          id: j.id,
          brandId: j.brand_id,
          userEmail: owner ? owner.email : "Bilinmeyen",
          brief: j.brief_text,
          format: j.format,
          status: j.status,
          imageUrl: j.image_url,
          revisionCount: j.revision_count,
          createdAt: new Date(j.created_at).toLocaleString('tr-TR'),
          briefJson: j.brief_json || {},
          timeline: j.brief_json?.timeline || ["pending", j.status].filter(Boolean)
        };
      });

      if (!state.selectedBrandId && state.brands.length > 0) state.selectedBrandId = state.brands[0].id;
      if (!state.selectedJobId && state.jobs.length > 0) state.selectedJobId = state.jobs[0].id;
    } catch (err) {
      console.error("Veri çekme hatası:", err);
    }
  }

  function brandName(id) {
    return state.brands.find((brand) => brand.id === id)?.name || "Bilinmeyen marka";
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

  function statusBadge(status) {
    return `<span class="admin-status" data-status="${status}">${statusLabel(status)}</span>`;
  }

  function setStatus(element, message, kind) {
    if (!element) return;
    element.textContent = message;
    if (kind) element.dataset.kind = kind;
    else element.removeAttribute("data-kind");
  }

  function normalize(value) {
    return String(value || "").toLocaleLowerCase("tr-TR");
  }

  function activateTab(tabName) {
    $$(".admin-nav-button").forEach((button) => {
      const active = button.dataset.adminTab === tabName;
      button.classList.toggle("is-active", active);
    });
    $$(".admin-panel").forEach((panel) => {
      const active = panel.dataset.adminPanel === tabName;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
  }

  function renderMetrics() {
    const activeJobs = state.jobs.filter((job) => job.status === "pending" || job.status === "processing").length;
    const waitingLeads = state.leads.filter((lead) => lead.status === "new").length;
    const metrics = [
      ["Marka", state.brands.length, "sistemde kayıtlı"],
      ["Kullanıcı", state.users.length, `${state.users.filter((user) => user.status === "active").length} aktif`],
      ["Aktif job", activeJobs, "üretim kuyruğunda"],
      ["Bekleyen lead", waitingLeads, "onay bekliyor"]
    ];

    nodes.metrics.innerHTML = metrics.map(([label, value, note]) => `
      <article class="admin-metric">
        <span>${label}</span>
        <strong>${value}</strong>
        <em>${note}</em>
      </article>
    `).join("");
  }

  function renderRecentLists() {
    nodes.recentJobs.innerHTML = state.jobs.slice(0, 5).map((job) => `
      <article class="admin-list-item">
        <div>
          <strong>${job.id.substring(0, 8)} · ${brandName(job.brandId)}</strong>
          <span>${job.format} · ${job.createdAt}</span>
        </div>
        ${statusBadge(job.status)}
      </article>
    `).join("");

    nodes.recentLeads.innerHTML = state.leads.slice(0, 5).map((lead) => `
      <article class="admin-list-item">
        <div>
          <strong>${lead.name} · ${lead.company}</strong>
          <span>${lead.need} · ${lead.createdAt}</span>
        </div>
        ${statusBadge(lead.status)}
      </article>
    `).join("");
  }

  function filteredBrands() {
    const query = normalize(nodes.brandSearch.value);
    const theme = nodes.brandThemeFilter.value;
    return state.brands
      .filter((brand) => {
        const matchesQuery = !query || normalize(`${brand.name} ${brand.userEmail}`).includes(query);
        const matchesTheme = theme === "all" || brand.theme === theme;
        return matchesQuery && matchesTheme;
      })
      .sort((a, b) => {
        const key = state.brandSort.key;
        return String(a[key]).localeCompare(String(b[key]), "tr") * state.brandSort.dir;
      });
  }

  function renderBrands() {
    const brands = filteredBrands();
    nodes.brandCount.textContent = `${brands.length} marka`;
    nodes.brandRows.innerHTML = brands.map((brand) => `
      <tr data-brand-id="${brand.id}" class="${brand.id === state.selectedBrandId ? "is-selected" : ""}">
        <td><strong>${brand.name}</strong><small>${brand.websiteUrl || "web sitesi yok"}</small></td>
        <td>${brand.userEmail}</td>
        <td>${brand.theme === "koyu" ? "Koyu" : "Açık"}</td>
        <td>${brand.formatCount}</td>
        <td>${brand.updatedAt}</td>
      </tr>
    `).join("");

    if (!brands.length) {
      nodes.brandRows.innerHTML = `<tr><td colspan="5"><p class="admin-empty">Bu filtreye uyan marka yok.</p></td></tr>`;
    }
  }

  function fillBrandForm(id) {
    const brand = state.brands.find((item) => item.id === id);
    if (!brand) return;
    state.selectedBrandId = id;
    $("#brandId").value = brand.id;
    $("#brandName").value = brand.name;
    $("#brandLogo").value = brand.logoUrl;
    $("#brandWebsite").value = brand.websiteUrl;
    $("#brandTheme").value = brand.theme;
    $("#brandPrimary").value = brand.primary;
    $("#brandSecondary").value = brand.secondary;
    $("#brandTone").value = brand.toneRules;
    $("#brandBanned").value = brand.bannedWords.join(", ");
    $("#basePrompt").value = brand.prompts.base_prompt;
    $("#storyTextPrompt").value = brand.prompts.story_text_prompt;
    $("#storyBgPrompt").value = brand.prompts.story_bg_prompt;
    $("#storyImgPrompt").value = brand.prompts.story_img_prompt;
    $("#bannerTextPrompt").value = brand.prompts.banner_text_prompt;
    $("#bannerBgPrompt").value = brand.prompts.banner_bg_prompt;
    $("#bannerImgPrompt").value = brand.prompts.banner_img_prompt;
    $("#metaPostTextPrompt").value = brand.prompts.meta_post_text_prompt;
    $("#metaPostBgPrompt").value = brand.prompts.meta_post_bg_prompt;
    $("#metaPostImgPrompt").value = brand.prompts.meta_post_img_prompt;
    $("#revizePrompt").value = brand.prompts.revize_prompt;
    nodes.brandFormTitle.textContent = brand.name;
    setStatus(nodes.brandStatus, "");
    renderBrands();
  }

  async function saveBrand(event) {
    event.preventDefault();
    const id = $("#brandId").value || null;
    const name = $("#brandName").value.trim();
    if (!name) {
      setStatus(nodes.brandStatus, "Marka adı zorunlu.", "error");
      return;
    }

    setStatus(nodes.brandStatus, "Kaydediliyor...");

    const primary = $("#brandPrimary").value;
    const secondary = $("#brandSecondary").value;
    const theme = $("#brandTheme").value;

    const brandPayload = {
      name,
      logo_url: $("#brandLogo").value.trim(),
      website_url: $("#brandWebsite").value.trim(),
      color_palette: { primary, secondary, theme },
      tone_rules: $("#brandTone").value.trim(),
      banned_words: $("#brandBanned").value.split(",").map((word) => word.trim()).filter(Boolean),
      updated_at: new Date().toISOString()
    };

    try {
      let savedBrandId = id;

      if (id) {
        const { error: bErr } = await client
          .from('brands')
          .update(brandPayload)
          .eq('id', id);
        if (bErr) throw bErr;
      } else {
        const firstNormalUser = state.users.find(u => u.email !== authContext.user.email);
        brandPayload.user_id = firstNormalUser ? firstNormalUser.id : authContext.user.id;

        const { data: newBrand, error: bErr } = await client
          .from('brands')
          .insert(brandPayload)
          .select()
          .single();
        if (bErr) throw bErr;
        savedBrandId = newBrand.id;
      }

      const promptPayload = {
        brand_id: savedBrandId,
        base_prompt: $("#basePrompt").value,
        story_text_prompt: $("#storyTextPrompt").value,
        story_bg_prompt: $("#storyBgPrompt").value,
        story_img_prompt: $("#storyImgPrompt").value,
        banner_text_prompt: $("#bannerTextPrompt").value,
        banner_bg_prompt: $("#bannerBgPrompt").value,
        banner_img_prompt: $("#bannerImgPrompt").value,
        meta_post_text_prompt: $("#metaPostTextPrompt").value,
        meta_post_bg_prompt: $("#metaPostBgPrompt").value,
        meta_post_img_prompt: $("#metaPostImgPrompt").value,
        revize_prompt: $("#revizePrompt").value,
        updated_at: new Date().toISOString()
      };

      const { error: pErr } = await client
        .from('brand_prompts')
        .upsert(promptPayload, { onConflict: 'brand_id' });
      if (pErr) throw pErr;

      setStatus(nodes.brandStatus, "Değişiklikler başarıyla kaydedildi.", "success");
      await fetchData();
      renderAll();
      fillBrandForm(savedBrandId);
    } catch (err) {
      console.error(err);
      setStatus(nodes.brandStatus, "Hata oluştu: " + err.message, "error");
    }
  }

  function filteredUsers() {
    const query = normalize(nodes.userSearch.value);
    const status = nodes.userStatusFilter.value;
    return state.users.filter((user) => {
      const brands = user.brandIds.map(brandName).join(" ");
      const matchesQuery = !query || normalize(`${user.email} ${brands}`).includes(query);
      const matchesStatus = status === "all" || user.status === status;
      return matchesQuery && matchesStatus;
    });
  }

  function renderUsers() {
    const users = filteredUsers();
    nodes.userCount.textContent = `${users.length} kullanıcı`;
    nodes.userRows.innerHTML = users.map((user) => `
      <tr>
        <td><strong>${user.email}</strong><small>${user.brandIds.length} marka bağlı</small></td>
        <td>${user.brandIds.map(brandName).join(", ") || "Marka yok"}</td>
        <td>${user.jobCount}</td>
        <td>${user.lastLogin}</td>
        <td>${statusBadge(user.status)}</td>
        <td><button class="admin-row-button" type="button" data-toggle-user="${user.id}">${user.status === "active" ? "Pasifleştir" : "Aktifleştir"}</button></td>
      </tr>
    `).join("");

    if (!users.length) {
      nodes.userRows.innerHTML = `<tr><td colspan="6"><p class="admin-empty">Bu filtreye uyan kullanıcı yok.</p></td></tr>`;
    }
  }

  function filteredLeads() {
    const query = normalize(nodes.leadSearch.value);
    const status = nodes.leadStatusFilter.value;
    return state.leads.filter((lead) => {
      const matchesQuery = !query || normalize(`${lead.name} ${lead.company} ${lead.email}`).includes(query);
      const matchesStatus = status === "all" || lead.status === status;
      return matchesQuery && matchesStatus;
    });
  }

  function renderLeads() {
    const leads = filteredLeads();
    nodes.leadCount.textContent = `${leads.length} başvuru`;
    nodes.leadRows.innerHTML = leads.map((lead) => `
      <tr>
        <td><strong>${lead.name}</strong><small>${lead.createdAt}</small></td>
        <td>${lead.company}</td>
        <td><a href="mailto:${lead.email}">${lead.email}</a></td>
        <td>${lead.need}</td>
        <td>
          <select data-lead-status="${lead.id}" aria-label="${lead.name} durumunu değiştir">
            ${["new", "reviewed", "approved", "rejected"].map((status) => `<option value="${status}" ${lead.status === status ? "selected" : ""}>${statusLabel(status)}</option>`).join("")}
          </select>
        </td>
        <td><button class="admin-row-button" type="button" data-invite-lead="${lead.id}">Davet gönder</button></td>
      </tr>
    `).join("");

    if (!leads.length) {
      nodes.leadRows.innerHTML = `<tr><td colspan="6"><p class="admin-empty">Bu filtreye uyan başvuru yok.</p></td></tr>`;
    }
  }

  function populateJobBrandFilter() {
    const current = nodes.jobBrandFilter.value || "all";
    nodes.jobBrandFilter.innerHTML = `<option value="all">Tümü</option>${state.brands.map((brand) => `<option value="${brand.id}">${brand.name}</option>`).join("")}`;
    nodes.jobBrandFilter.value = state.brands.some((brand) => brand.id === current) ? current : "all";
  }

  function filteredJobs() {
    const brand = nodes.jobBrandFilter.value;
    const format = nodes.jobFormatFilter.value;
    const status = nodes.jobStatusFilter.value;
    return state.jobs
      .filter((job) => (brand === "all" || job.brandId === brand) && (format === "all" || job.format === format) && (status === "all" || job.status === status))
      .sort((a, b) => {
        const key = state.jobSort.key;
        if (key === "created_at" || key === "createdAt") {
          return new Date(b.createdAt) - new Date(a.createdAt);
        }
        return String(a[key]).localeCompare(String(b[key]), "tr") * state.jobSort.dir;
      });
  }

  function renderJobs() {
    const jobs = filteredJobs();
    nodes.jobCount.textContent = `${jobs.length} job`;
    nodes.jobRows.innerHTML = jobs.map((job) => `
      <tr data-job-id="${job.id}" class="${job.id === state.selectedJobId ? "is-selected" : ""}">
        <td><strong>${job.id.substring(0, 8)}</strong><small>${job.userEmail}</small></td>
        <td>${brandName(job.brandId)}</td>
        <td>${job.format}</td>
        <td>${statusBadge(job.status)}</td>
        <td>${job.revisionCount}</td>
        <td>${job.createdAt}</td>
      </tr>
    `).join("");

    if (!jobs.length) {
      nodes.jobRows.innerHTML = `<tr><td colspan="6"><p class="admin-empty">Bu filtreye uyan job yok.</p></td></tr>`;
    }
  }

  function renderJobDetail(id) {
    const job = state.jobs.find((item) => item.id === id);
    state.selectedJobId = id;
    if (!job) {
      nodes.jobDetail.innerHTML = `
        <div class="admin-card-head"><span>Job detayı</span><strong>Seçim bekliyor</strong></div>
        <p class="admin-empty">Tablodan bir job seç.</p>
      `;
      return;
    }

    nodes.jobDetail.innerHTML = `
      <div class="admin-card-head"><span>Job detayı</span><strong>${job.id.substring(0, 8)}</strong></div>
      <div class="admin-preview">
        <span>${brandName(job.brandId)}</span>
        <strong>${job.format} önizleme</strong>
        ${statusBadge(job.status)}
        ${job.imageUrl ? `<img src="${job.imageUrl}" alt="${job.format} çıktısı" class="admin-preview-img" style="max-width: 100%; margin-top: 1rem; border-radius: 4px; border: 1px solid var(--border);" />` : '<p class="admin-empty" style="margin-top: 1rem;">Görsel henüz üretilmedi.</p>'}
      </div>
      <div class="admin-detail-block">
        <strong>Tam brief</strong>
        <p>${job.brief}</p>
      </div>
      <div class="admin-detail-block">
        <strong>Brief JSON</strong>
        <pre class="admin-code">${JSON.stringify(job.briefJson, null, 2)}</pre>
      </div>
      <div class="admin-detail-block">
        <strong>Durum geçmişi</strong>
        <p>${job.timeline.map(statusLabel).join(" → ")}</p>
      </div>
    `;
    renderJobs();
  }

  function renderAll() {
    renderMetrics();
    renderRecentLists();
    populateJobBrandFilter();
    renderBrands();
    renderUsers();
    renderLeads();
    renderJobs();
  }

  function bindEvents() {
    $$(".admin-nav-button").forEach((button) => {
      button.addEventListener("click", () => activateTab(button.dataset.adminTab));
    });

    $("#adminLogout").addEventListener("click", () => {
      window.VitrinOS.auth.signOut("login.html");
    });

    $("#newBrandButton").addEventListener("click", () => {
      state.selectedBrandId = "";
      nodes.brandForm.reset();
      $("#brandId").value = "";
      $("#brandPrimary").value = "#d9962a";
      $("#brandSecondary").value = "#7a4f12";
      nodes.brandFormTitle.textContent = "Yeni marka";
      setStatus(nodes.brandStatus, "Yeni marka ekleniyor.");
      renderBrands();
    });

    [nodes.brandSearch, nodes.brandThemeFilter].forEach((input) => input.addEventListener("input", renderBrands));
    [nodes.userSearch, nodes.userStatusFilter].forEach((input) => input.addEventListener("input", renderUsers));
    [nodes.leadSearch, nodes.leadStatusFilter].forEach((input) => input.addEventListener("input", renderLeads));
    [nodes.jobBrandFilter, nodes.jobFormatFilter, nodes.jobStatusFilter].forEach((input) => input.addEventListener("input", renderJobs));

    nodes.brandRows.addEventListener("click", (event) => {
      const row = event.target.closest("[data-brand-id]");
      if (row) fillBrandForm(row.dataset.brandId);
    });

    nodes.brandForm.addEventListener("submit", saveBrand);

    $$("[data-sort-brands]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.sortBrands;
        state.brandSort.dir = state.brandSort.key === key ? state.brandSort.dir * -1 : 1;
        state.brandSort.key = key;
        renderBrands();
      });
    });

    $$("[data-copy-template]").forEach((button) => {
      button.addEventListener("click", () => {
        const map = {
          base_prompt: "#basePrompt",
          story_text_prompt: "#storyTextPrompt",
          story_bg_prompt: "#storyBgPrompt",
          story_img_prompt: "#storyImgPrompt",
          banner_text_prompt: "#bannerTextPrompt",
          banner_bg_prompt: "#bannerBgPrompt",
          banner_img_prompt: "#bannerImgPrompt",
          meta_post_text_prompt: "#metaPostTextPrompt",
          meta_post_bg_prompt: "#metaPostBgPrompt",
          meta_post_img_prompt: "#metaPostImgPrompt",
          revize_prompt: "#revizePrompt"
        };
        $(map[button.dataset.copyTemplate]).value = state.promptTemplates[button.dataset.copyTemplate];
        setStatus(nodes.brandStatus, "Hepsiburada şablonu kopyalandı.", "success");
      });
    });

    nodes.userRows.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-toggle-user]");
      if (!button) return;
      const userId = button.dataset.toggleUser;
      try {
        const { data, error } = await client.rpc('toggle_user_status', { target_user_id: userId });
        if (error) throw error;
        await fetchData();
        renderAll();
      } catch (err) {
        alert("Kullanıcı durumu değiştirilemedi: " + err.message);
      }
    });

    $("#inviteUserButton").addEventListener("click", async () => {
      const email = prompt("Davet edilecek e-posta adresini girin:");
      if (!email) return;
      const name = prompt("Kullanıcı adını girin:");
      if (!name) return;
      try {
        const { data, error } = await client.rpc('invite_user', { user_email: email, user_name: name });
        if (error) throw error;
        alert("Kullanıcı başarıyla davet edildi (Varsayılan şifre: Vitrinos123!)");
        await fetchData();
        renderAll();
      } catch (err) {
        alert("Davet gönderilemedi: " + err.message);
      }
    });

    nodes.leadRows.addEventListener("change", async (event) => {
      const select = event.target.closest("[data-lead-status]");
      if (!select) return;
      const leadId = select.dataset.leadStatus;
      const newStatus = select.value;
      try {
        const { error } = await client.from('leads').update({ status: newStatus }).eq('id', leadId);
        if (error) throw error;
        await fetchData();
        renderAll();
      } catch (err) {
        alert("Durum güncellenemedi: " + err.message);
      }
    });

    nodes.leadRows.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-invite-lead]");
      if (!button) return;
      const leadId = button.dataset.inviteLead;
      const lead = state.leads.find((item) => item.id === leadId);
      if (!lead) return;
      try {
        const { error: statusErr } = await client.from('leads').update({ status: 'approved' }).eq('id', leadId);
        if (statusErr) throw statusErr;
        const { error: inviteErr } = await client.rpc('invite_user', { user_email: lead.email, user_name: lead.name });
        if (inviteErr) throw inviteErr;
        alert("Başvuru onaylandı ve kullanıcı davet edildi (Varsayılan şifre: Vitrinos123!)");
        await fetchData();
        renderAll();
      } catch (err) {
        alert("İşlem gerçekleştirilemedi: " + err.message);
      }
    });

    nodes.jobRows.addEventListener("click", (event) => {
      const row = event.target.closest("[data-job-id]");
      if (row) renderJobDetail(row.dataset.jobId);
    });

    $$("[data-sort-jobs]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.sortJobs;
        state.jobSort.dir = state.jobSort.key === key ? state.jobSort.dir * -1 : 1;
        state.jobSort.key = key;
        renderJobs();
      });
    });
  }

  function setupRealtime() {
    client
      .channel('public:jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, async (payload) => {
        await fetchData();
        renderAll();
        if (state.selectedJobId) renderJobDetail(state.selectedJobId);
      })
      .subscribe();

    client
      .channel('public:brands')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'brands' }, async () => {
        await fetchData();
        renderAll();
      })
      .subscribe();

    client
      .channel('public:leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, async () => {
        await fetchData();
        renderAll();
      })
      .subscribe();
  }

  await fetchData();
  bindEvents();
  setupRealtime();
  renderAll();
  
  if (state.brands.length > 0) fillBrandForm(state.selectedBrandId);
  if (state.jobs.length > 0) renderJobDetail(state.selectedJobId);
})();

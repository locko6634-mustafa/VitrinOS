(async function () {
  const authContext = await window.VitrinOS.auth.requireAdmin({
    redirectTo: "login.html",
    fallbackTo: "dashboard.html"
  });

  if (!authContext) return;

  const client = window.VitrinOS.auth.getClient();

  const adminConfig = window.VitrinOS.config.defaults.admin;
  const colors = window.VitrinOS.config.defaults.colors;
  const PAGE_SIZE = adminConfig.pageSize;
  const state = {
    selectedBrandId: "",
    selectedJobId: "",
    brandSort: { key: "name", dir: 1 },
    jobSort: { key: "createdAt", dir: -1 },
    brands: [],
    users: [],
    leads: [],
    jobs: [],
    jobPage: 0,
    leadPage: 0,
    hasMoreJobs: false,
    hasMoreLeads: false,
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
    brandOwner: $("#brandOwner"),
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
    jobStatusFilter: $("#jobStatusFilter"),
    confirmDialog: $("#adminConfirmDialog"),
    confirmTitle: $("#adminConfirmTitle"),
    confirmMessage: $("#adminConfirmMessage"),
    confirmButton: $("#adminConfirmButton"),
    inviteDialog: $("#adminInviteDialog"),
    inviteForm: $("#adminInviteForm"),
    inviteEmail: $("#adminInviteEmail"),
    inviteName: $("#adminInviteName"),
    toastRegion: $("#adminToastRegion")
  };

  async function runAdminUserAction(payload) {
    const functionName = window.VitrinOS.config.adminUserActionFunction;
    const { data: sessionData, error: sessionError } = await client.auth.getSession();

    if (sessionError) throw sessionError;

    let session = sessionData.session;
    if (!session) {
      throw new Error("Oturum bulunamadı. Lütfen yeniden giriş yapın.");
    }

    const expiresSoon = !session.expires_at || session.expires_at * 1000 - Date.now() < 60_000;
    if (expiresSoon) {
      const { data: refreshedData, error: refreshError } = await client.auth.refreshSession();
      if (refreshError || !refreshedData.session) {
        throw refreshError || new Error("Oturum yenilenemedi. Lütfen yeniden giriş yapın.");
      }
      session = refreshedData.session;
    }

    const { data, error } = await client.functions.invoke(functionName, {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      },
      body: {
        ...payload
      }
    });

    if (error) throw error;
    if (!data?.ok) {
      throw new Error(data?.message || "Islem tamamlanamadi.");
    }

    return data;
  }

  async function fetchData() {
    try {
      const { data: dbBrands, error: bErr } = await client
        .from('brands')
        .select('id,user_id,name,logo_url,website_url,color_palette,tone_rules,banned_words,updated_at, brand_prompts(brand_id,base_prompt,story_text_prompt,story_bg_prompt,story_img_prompt,banner_text_prompt,banner_bg_prompt,banner_img_prompt,meta_post_text_prompt,meta_post_bg_prompt,meta_post_img_prompt,revize_prompt)');
      if (bErr) throw bErr;

      const { data: dbUsers, error: uErr } = await client
        .from('users')
        .select('id,email,last_sign_in_at,banned_until');
      if (uErr) throw uErr;

      const leadFrom = state.leadPage * PAGE_SIZE;
      const { data: leadPage, error: lErr } = await client
        .from('leads')
        .select('id,name,company,email,website,need,note,status,created_at')
        .order('created_at', { ascending: false })
        .range(leadFrom, leadFrom + PAGE_SIZE);
      if (lErr) throw lErr;

      const jobFrom = state.jobPage * PAGE_SIZE;
      const { data: jobPage, error: jErr } = await client
        .from('jobs')
        .select('id,user_id,brand_id,brief_text,format,status,image_url,revision_count,brief_json,created_at')
        .order('created_at', { ascending: false })
        .range(jobFrom, jobFrom + PAGE_SIZE);
      if (jErr) throw jErr;

      state.hasMoreLeads = leadPage.length > PAGE_SIZE;
      state.hasMoreJobs = jobPage.length > PAGE_SIZE;
      const dbLeads = leadPage.slice(0, PAGE_SIZE);
      const jobsWithAssetUrls = jobPage.slice(0, PAGE_SIZE);

      state.users = dbUsers.map(u => ({
        id: u.id,
        email: u.email,
        brandIds: dbBrands.filter(b => b.user_id === u.id).map(b => b.id),
        jobCount: jobsWithAssetUrls.filter(j => j.user_id === u.id).length,
        lastLogin: u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('tr-TR') : "Hiç giriş yapmadı",
        hasSignedIn: Boolean(u.last_sign_in_at),
        status: u.banned_until ? "inactive" : "active"
      }));

      populateBrandOwnerOptions();

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
          primary: b.color_palette?.primary || colors.primary,
          secondary: b.color_palette?.secondary || colors.secondary,
          theme: b.color_palette?.theme || "koyu",
          toneRules: b.tone_rules || "",
          bannedWords: b.banned_words || [],
          formatCount: jobsWithAssetUrls.filter(j => j.brand_id === b.id).length,
          updatedAtRaw: b.updated_at,
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

      state.jobs = jobsWithAssetUrls.map(j => {
        const owner = state.users.find(u => u.id === j.user_id);
        return {
          id: j.id,
          brandId: j.brand_id,
          userEmail: owner ? owner.email : "Bilinmeyen",
          brief: j.brief_text,
          format: j.format,
          status: j.status,
          imageUrl: '',
          imagePath: j.image_url || '',
          revisionCount: j.revision_count,
          createdAtRaw: j.created_at,
          createdAt: new Date(j.created_at).toLocaleString('tr-TR'),
          briefJson: j.brief_json || {},
          timeline: j.brief_json?.timeline || ["pending", j.status].filter(Boolean)
        };
      });

      if (!state.selectedBrandId && state.brands.length > 0) state.selectedBrandId = state.brands[0].id;
      if (!state.selectedJobId && state.jobs.length > 0) state.selectedJobId = state.jobs[0].id;
    } catch (err) {
      console.error("Veri çekme hatası:", err);
      notify("Operasyon verileri yüklenemedi. Bağlantıyı kontrol edip yeniden deneyin.", "error");
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
      ...window.VitrinOS.config.defaults.statuses.labels
    };
    return labels[status] || status;
  }

  function statusBadge(status) {
    const badge = document.createElement("span");
    badge.className = "admin-status";
    badge.dataset.status = status;
    badge.textContent = statusLabel(status);
    return badge;
  }

  function textElement(tagName, text, className) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text ?? "";
    return element;
  }

  function createEmptyRow(colspan, message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    const empty = textElement("p", message, "admin-empty");
    cell.colSpan = colspan;
    cell.append(empty);
    row.append(cell);
    return row;
  }

  function appendTextCell(row, text, label) {
    const cell = document.createElement("td");
    if (label) cell.dataset.label = label;
    cell.append(textElement("span", text ?? "", "admin-cell-value"));
    row.append(cell);
    return cell;
  }

  function populateBrandOwnerOptions() {
    if (!nodes.brandOwner) return;
    const current = nodes.brandOwner.value;
    nodes.brandOwner.replaceChildren(new Option("Atanmamış", ""));
    state.users
      .slice()
      .sort((a, b) => a.email.localeCompare(b.email, "tr"))
      .forEach((user) => nodes.brandOwner.append(new Option(user.email, user.id)));
    nodes.brandOwner.value = state.users.some((user) => user.id === current) ? current : "";
  }

  function setStatus(element, message, kind) {
    if (!element) return;
    element.textContent = message;
    if (kind) element.dataset.kind = kind;
    else element.removeAttribute("data-kind");
  }

  function notify(message, kind = "info") {
    if (!nodes.toastRegion) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.dataset.kind = kind;
    toast.setAttribute("role", kind === "error" ? "alert" : "status");
    toast.append(textElement("span", message));
    nodes.toastRegion.append(toast);
    window.setTimeout(() => toast.remove(), 4800);
  }

  function askConfirmation({ title, message, confirmLabel = "Onayla", danger = false }) {
    if (!nodes.confirmDialog?.showModal) {
      notify("Onay penceresi bu tarayıcıda açılamadı.", "error");
      return Promise.resolve(false);
    }

    nodes.confirmTitle.textContent = title;
    nodes.confirmMessage.textContent = message;
    nodes.confirmButton.textContent = confirmLabel;
    nodes.confirmButton.dataset.danger = String(danger);
    nodes.confirmDialog.returnValue = "cancel";

    return new Promise((resolve) => {
      nodes.confirmDialog.addEventListener("close", () => {
        nodes.confirmButton.removeAttribute("data-danger");
        resolve(nodes.confirmDialog.returnValue === "confirm");
      }, { once: true });
      nodes.confirmDialog.showModal();
    });
  }

  function askInviteDetails() {
    if (!nodes.inviteDialog?.showModal) {
      notify("Davet penceresi bu tarayıcıda açılamadı.", "error");
      return Promise.resolve(null);
    }

    nodes.inviteForm.reset();
    nodes.inviteDialog.returnValue = "cancel";

    return new Promise((resolve) => {
      nodes.inviteDialog.addEventListener("close", () => {
        if (nodes.inviteDialog.returnValue !== "confirm") {
          resolve(null);
          return;
        }
        resolve({
          email: nodes.inviteEmail.value.trim(),
          name: nodes.inviteName.value.trim()
        });
      }, { once: true });
      nodes.inviteDialog.showModal();
    });
  }

  function normalize(value) {
    return String(value || "").toLocaleLowerCase("tr-TR");
  }

  function setAdminDrawerState(isOpen, { restoreFocus = false } = {}) {
    const sidebar = document.getElementById("adminSidebar");
    const topbar = document.getElementById("adminTopbar");
    const toggle = document.getElementById("adminNavToggle");
    if (!sidebar || !topbar || !toggle) return;

    const isDrawerViewport = window.innerWidth <= adminConfig.mobileBreakpoint;
    const drawerIsOpen = isDrawerViewport && isOpen;
    const wasOpen = document.body.classList.contains("admin-sidebar-open");

    sidebar.classList.toggle("is-open", drawerIsOpen);
    topbar.classList.toggle("is-open", drawerIsOpen);
    document.body.classList.toggle("admin-sidebar-open", drawerIsOpen);
    toggle.setAttribute("aria-expanded", String(drawerIsOpen));
    toggle.setAttribute("aria-label", drawerIsOpen ? "Operasyon menüsünü kapat" : "Operasyon menüsünü aç");
    sidebar.inert = isDrawerViewport && !drawerIsOpen;
    if (isDrawerViewport && !drawerIsOpen) sidebar.setAttribute("aria-hidden", "true");
    else sidebar.removeAttribute("aria-hidden");

    [
      document.getElementById("admin-main"),
      topbar.querySelector(".brand"),
      topbar.querySelector(".admin-context"),
      topbar.querySelector(".admin-topbar-actions")
    ].filter(Boolean).forEach((target) => {
      target.inert = drawerIsOpen;
    });

    if (restoreFocus && wasOpen) toggle.focus();
  }

  function activateTab(tabName) {
    const updatePanels = () => {
      $$(".admin-nav-button").forEach((button) => {
        const active = button.dataset.adminTab === tabName;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
        button.tabIndex = active ? 0 : -1;
      });
      $$(".admin-panel").forEach((panel) => {
        const active = panel.dataset.adminPanel === tabName;
        panel.classList.toggle("is-active", active);
        panel.hidden = !active;
      });
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (document.startViewTransition && !reduceMotion) {
      document.startViewTransition(updatePanels);
    } else {
      updatePanels();
    }

    const drawerWasOpen = document.body.classList.contains("admin-sidebar-open");
    if (drawerWasOpen) setAdminDrawerState(false, { restoreFocus: true });

    if (window.innerWidth <= adminConfig.mobileBreakpoint) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  function renderMetrics() {
    const activeJobs = state.jobs.filter((job) => job.status === "pending" || job.status === "processing").length;
    const waitingLeads = state.leads.filter((lead) => lead.status === "new").length;
    const metrics = [
      ["Marka", state.brands.length, "yüklenen görünümde"],
      ["Kullanıcı", state.users.length, `${state.users.filter((user) => user.status === "active").length} aktif · yüklenen görünüm`],
      ["Aktif job", activeJobs, "yüklenen job sayfasında"],
      ["Bekleyen lead", waitingLeads, "yüklenen lead sayfasında"]
    ];

    nodes.metrics.replaceChildren(...metrics.map(([label, value, note]) => {
      const metric = document.createElement("article");
      metric.className = "admin-metric";
      metric.append(
        textElement("span", label),
        textElement("strong", value),
        textElement("em", note)
      );
      return metric;
    }));
  }

  function renderRecentLists() {
    nodes.recentJobs.replaceChildren(...state.jobs.slice(0, 5).map((job) => {
      const item = document.createElement("article");
      item.className = "admin-list-item";
      const content = document.createElement("div");
      content.append(
        textElement("strong", `${job.id.substring(0, 8)} · ${brandName(job.brandId)}`),
        textElement("span", `${job.format} · ${job.createdAt}`)
      );
      item.append(content, statusBadge(job.status));
      return item;
    }));

    nodes.recentLeads.replaceChildren(...state.leads.slice(0, 5).map((lead) => {
      const item = document.createElement("article");
      item.className = "admin-list-item";
      const content = document.createElement("div");
      content.append(
        textElement("strong", `${lead.name} · ${lead.company}`),
        textElement("span", `${lead.need} · ${lead.createdAt}`)
      );
      item.append(content, statusBadge(lead.status));
      return item;
    }));
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
        if (key === "updatedAt") {
          return (new Date(a.updatedAtRaw) - new Date(b.updatedAtRaw)) * state.brandSort.dir;
        }
        return String(a[key]).localeCompare(String(b[key]), "tr") * state.brandSort.dir;
      });
  }

  function renderBrands() {
    const brands = filteredBrands();
    nodes.brandCount.textContent = `${brands.length} marka`;

    if (!brands.length) {
      nodes.brandRows.replaceChildren(createEmptyRow(5, "Bu filtreye uyan marka yok."));
      return;
    }

    nodes.brandRows.replaceChildren(...brands.map((brand) => {
      const row = document.createElement("tr");
      row.dataset.brandId = brand.id;
      row.classList.toggle("is-selected", brand.id === state.selectedBrandId);

      const nameCell = document.createElement("td");
      nameCell.dataset.label = "Marka";
      const selectButton = document.createElement("button");
      selectButton.type = "button";
      selectButton.className = "admin-row-selector";
      selectButton.dataset.brandSelect = brand.id;
      selectButton.setAttribute("aria-label", `${brand.name} marka detayını aç`);
      selectButton.append(
        textElement("strong", brand.name),
        textElement("small", brand.websiteUrl || "web sitesi yok")
      );
      nameCell.append(selectButton);

      row.append(nameCell);
      appendTextCell(row, brand.userEmail, "Kullanıcı");
      appendTextCell(row, brand.theme === "koyu" ? "Koyu" : "Açık", "Tema");
      appendTextCell(row, brand.formatCount, "Format");
      appendTextCell(row, brand.updatedAt, "Güncelleme");
      return row;
    }));
  }

  function fillBrandForm(id, { focusForm = false } = {}) {
    const brand = state.brands.find((item) => item.id === id);
    if (!brand) return;
    state.selectedBrandId = id;
    $("#brandId").value = brand.id;
    $("#brandName").value = brand.name;
    $("#brandLogo").value = brand.logoUrl;
    $("#brandWebsite").value = brand.websiteUrl;
    nodes.brandOwner.value = brand.userId || "";
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
    if (focusForm) $("#brandName")?.focus();
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
      user_id: nodes.brandOwner.value || null,
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
        brandPayload.user_id = nodes.brandOwner.value || (firstNormalUser ? firstNormalUser.id : authContext.user.id);

        const { data: newBrand, error: bErr } = await client
          .from('brands')
          .insert(brandPayload)
          .select('id')
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

    if (!users.length) {
      nodes.userRows.replaceChildren(createEmptyRow(6, "Bu filtreye uyan kullanıcı yok."));
      return;
    }

    nodes.userRows.replaceChildren(...users.map((user) => {
      const row = document.createElement("tr");
      const userCell = document.createElement("td");
      userCell.dataset.label = "E-posta";
      userCell.append(
        textElement("strong", user.email),
        textElement("small", `${user.brandIds.length} marka bağlı`)
      );
      row.append(userCell);
      appendTextCell(row, user.brandIds.map(brandName).join(", ") || "Marka yok", "Marka");
      appendTextCell(row, user.jobCount, "Job");
      appendTextCell(row, user.lastLogin, "Son giriş");

      const statusCell = document.createElement("td");
      statusCell.dataset.label = "Durum";
      statusCell.append(statusBadge(user.status));
      row.append(statusCell);

      const actionCell = document.createElement("td");
      actionCell.dataset.label = "Aksiyon";
      const button = textElement("button", user.status === "active" ? "Pasifleştir" : "Aktifleştir", "admin-row-button");
      button.type = "button";
      button.dataset.toggleUser = user.id;
      const resetButton = textElement("button", "Sifre sifirla", "admin-row-button");
      resetButton.type = "button";
      resetButton.dataset.resetUser = user.id;
      resetButton.title = "Kullaniciya sifre sifirlama e-postasi gonder";
      button.disabled = user.id === authContext.user.id;
      button.title = button.disabled ? "Kendi hesabınızın durumunu değiştiremezsiniz" : "Kullanıcı durumunu değiştir";
      const deleteButton = textElement("button", "Sil", "admin-row-button danger");
      deleteButton.type = "button";
      deleteButton.dataset.deleteUser = user.id;
      deleteButton.disabled = user.id === authContext.user.id;
      deleteButton.title = deleteButton.disabled ? "Kendi admin hesabınız silinemez" : "Kullanıcıyı ve job kayıtlarını sil";
      actionCell.append(button, resetButton, deleteButton);
      row.append(actionCell);
      return row;
    }));
  }

  function filteredLeads() {
    const query = normalize(nodes.leadSearch.value);
    const status = nodes.leadStatusFilter.value;
    const registeredUserEmails = new Set(
      state.users
        .filter((user) => user.hasSignedIn)
        .map((user) => normalize(user.email))
        .filter(Boolean)
    );

    return state.leads.filter((lead) => {
      const hasAccount = registeredUserEmails.has(normalize(lead.email));
      const matchesQuery = !query || normalize(`${lead.name} ${lead.company} ${lead.email}`).includes(query);
      const matchesStatus = status === "all" || lead.status === status;
      return !hasAccount && matchesQuery && matchesStatus;
    });
  }

  function renderLeads() {
    const leads = filteredLeads();
    nodes.leadCount.textContent = `${leads.length} başvuru`;
    nodes.leadRows.closest('.admin-table-wrap').parentElement.querySelector('.list-pager[data-pager="lead"]')?.remove();

    if (!leads.length) {
      nodes.leadRows.replaceChildren(createEmptyRow(6, "Bu filtreye uyan başvuru yok."));
      renderPager(nodes.leadRows, 'lead');
      return;
    }

    nodes.leadRows.replaceChildren(...leads.map((lead) => {
      const row = document.createElement("tr");
      const nameCell = document.createElement("td");
      nameCell.dataset.label = "Ad";
      nameCell.append(textElement("strong", lead.name), textElement("small", lead.createdAt));
      row.append(nameCell);
      appendTextCell(row, lead.company, "Şirket");

      const emailCell = document.createElement("td");
      emailCell.dataset.label = "E-posta";
      const emailLink = textElement("a", lead.email);
      emailLink.href = `mailto:${encodeURIComponent(lead.email)}`;
      emailCell.append(emailLink);
      row.append(emailCell);

      appendTextCell(row, lead.need, "İhtiyaç");

      const statusCell = document.createElement("td");
      statusCell.dataset.label = "Durum";
      const select = document.createElement("select");
      select.dataset.leadStatus = lead.id;
      select.setAttribute("aria-label", `${lead.name} durumunu değiştir`);
      ["new", "reviewed", "approved", "rejected"].forEach((status) => {
        const option = document.createElement("option");
        option.value = status;
        option.selected = lead.status === status;
        option.textContent = statusLabel(status);
        select.append(option);
      });
      statusCell.append(select);
      row.append(statusCell);

      const actionCell = document.createElement("td");
      actionCell.dataset.label = "Aksiyon";
      const button = textElement("button", "Davet gönder", "admin-row-button");
      button.type = "button";
      button.dataset.inviteLead = lead.id;
      actionCell.append(button);
      row.append(actionCell);
      return row;
    }));
    renderPager(nodes.leadRows, 'lead');
  }

  function populateJobBrandFilter() {
    const current = nodes.jobBrandFilter.value || "all";
    nodes.jobBrandFilter.replaceChildren();

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "Tümü";
    nodes.jobBrandFilter.append(allOption);

    state.brands.forEach((brand) => {
      const option = document.createElement("option");
      option.value = brand.id;
      option.textContent = brand.name;
      nodes.jobBrandFilter.append(option);
    });

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
        if (key === "createdAt") {
          return (new Date(a.createdAtRaw) - new Date(b.createdAtRaw)) * state.jobSort.dir;
        }
        return String(a[key]).localeCompare(String(b[key]), "tr") * state.jobSort.dir;
      });
  }

  function renderJobs() {
    const jobs = filteredJobs();
    nodes.jobCount.textContent = `${jobs.length} job`;
    nodes.jobRows.closest('.admin-table-wrap').parentElement.querySelector('.list-pager[data-pager="job"]')?.remove();

    if (!jobs.length) {
      nodes.jobRows.replaceChildren(createEmptyRow(6, "Bu filtreye uyan job yok."));
      renderPager(nodes.jobRows, 'job');
      return;
    }

    nodes.jobRows.replaceChildren(...jobs.map((job) => {
      const row = document.createElement("tr");
      row.dataset.jobId = job.id;
      row.classList.toggle("is-selected", job.id === state.selectedJobId);

      const idCell = document.createElement("td");
      idCell.dataset.label = "Job ID";
      const selectButton = document.createElement("button");
      selectButton.type = "button";
      selectButton.className = "admin-row-selector";
      selectButton.dataset.jobSelect = job.id;
      selectButton.setAttribute("aria-label", `${job.id.substring(0, 8)} job detayını aç`);
      selectButton.append(textElement("strong", job.id.substring(0, 8)), textElement("small", job.userEmail));
      idCell.append(selectButton);
      row.append(idCell);
      appendTextCell(row, brandName(job.brandId), "Marka");
      appendTextCell(row, job.format, "Format");

      const statusCell = document.createElement("td");
      statusCell.dataset.label = "Durum";
      statusCell.append(statusBadge(job.status));
      row.append(statusCell);

      appendTextCell(row, job.revisionCount, "Revizyon");
      appendTextCell(row, job.createdAt, "Tarih");
      return row;
    }));
    renderPager(nodes.jobRows, 'job');
  }

  function renderPager(rows, type) {
    const tableWrap = rows.closest('.admin-table-wrap');
    tableWrap.parentElement.querySelector(`.list-pager[data-pager="${type}"]`)?.remove();
    const pager = document.createElement('div');
    pager.className = 'list-pager';
    pager.dataset.pager = type;
    const pageKey = type === 'job' ? 'jobPage' : 'leadPage';
    const moreKey = type === 'job' ? 'hasMoreJobs' : 'hasMoreLeads';
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.textContent = 'Önceki';
    previous.disabled = state[pageKey] === 0;
    const next = document.createElement('button');
    next.type = 'button';
    next.textContent = 'Sonraki';
    next.disabled = !state[moreKey];
    const changePage = async (delta) => {
      state[pageKey] += delta;
      await fetchData();
      renderAll();
    };
    previous.addEventListener('click', () => changePage(-1));
    next.addEventListener('click', () => changePage(1));
    pager.append(previous, next);
    tableWrap.after(pager);
  }

  function renderJobDetail(id, { focusDetail = false } = {}) {
    const job = state.jobs.find((item) => item.id === id);
    state.selectedJobId = id;
    if (!job) {
      const head = document.createElement("div");
      head.className = "admin-card-head";
      head.append(textElement("span", "Job detayı"), textElement("strong", "Seçim bekliyor"));
      nodes.jobDetail.replaceChildren(head, textElement("p", "Tablodan bir job seç.", "admin-empty"));
      return;
    }

    if (job.imagePath && !job.imageUrl) {
      window.VitrinOS.storage.getGeneratedAssetUrl(job.imagePath)
        .then((url) => {
          job.imageUrl = url;
          if (state.selectedJobId === id) renderJobDetail(id);
        })
        .catch((error) => console.error('Görsel signed URL hatası:', error));
    }

    const head = document.createElement("div");
    head.className = "admin-card-head";
    head.append(textElement("span", "Job detayı"), textElement("strong", job.id.substring(0, 8)));

    const preview = document.createElement("div");
    preview.className = "admin-preview";
    preview.append(
      textElement("span", brandName(job.brandId)),
      textElement("strong", `${job.format} önizleme`),
      statusBadge(job.status)
    );

    if (job.imageUrl) {
      const img = document.createElement("img");
      img.src = job.imageUrl;
      img.alt = `${job.format} çıktısı`;
      img.className = "admin-preview-img";
      preview.append(img);
    } else {
      const empty = textElement("p", "Görsel henüz üretilmedi.", "admin-empty");
      preview.append(empty);
    }

    const briefBlock = document.createElement("div");
    briefBlock.className = "admin-detail-block";
    briefBlock.append(textElement("strong", "Tam brief"), textElement("p", job.brief));

    const jsonBlock = document.createElement("div");
    jsonBlock.className = "admin-detail-block";
    jsonBlock.append(textElement("strong", "Brief JSON"));
    const code = textElement("pre", JSON.stringify(job.briefJson, null, 2), "admin-code");
    jsonBlock.append(code);

    const timelineBlock = document.createElement("div");
    timelineBlock.className = "admin-detail-block";
    timelineBlock.append(textElement("strong", "Durum geçmişi"), textElement("p", job.timeline.map(statusLabel).join(" → ")));

    nodes.jobDetail.replaceChildren(head, preview, briefBlock, jsonBlock, timelineBlock);
    renderJobs();
    if (focusDetail) nodes.jobDetail.focus();
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
    const adminNavToggle = document.getElementById("adminNavToggle");
    const adminSidebar = document.getElementById("adminSidebar");
    const adminTopbar = document.getElementById("adminTopbar");

    if (adminNavToggle && adminSidebar && adminTopbar) {
      adminNavToggle.addEventListener("click", () => {
        const isOpen = !adminSidebar.classList.contains("is-open");
        setAdminDrawerState(isOpen);
        if (isOpen) adminSidebar.querySelector(".admin-nav-button.is-active")?.focus();
      });

      document.body.addEventListener("click", (event) => {
        if (
          document.body.classList.contains("admin-sidebar-open") &&
          !event.target.closest("#adminSidebar") &&
          !event.target.closest("#adminNavToggle") &&
          !event.target.closest("#adminTopbar")
        ) {
          setAdminDrawerState(false);
        }
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && document.body.classList.contains("admin-sidebar-open")) {
          setAdminDrawerState(false, { restoreFocus: true });
          return;
        }

        if (event.key === "Tab" && document.body.classList.contains("admin-sidebar-open")) {
          const focusable = [
            adminNavToggle,
            ...adminSidebar.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')
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
    }

    const navButtons = $$(".admin-nav-button");
    navButtons.forEach((button, index) => {
      button.addEventListener("click", () => activateTab(button.dataset.adminTab));
      button.addEventListener("keydown", (event) => {
        const direction = event.key === "ArrowDown" || event.key === "ArrowRight"
          ? 1
          : event.key === "ArrowUp" || event.key === "ArrowLeft"
            ? -1
            : 0;
        let targetIndex = index;
        if (event.key === "Home") targetIndex = 0;
        else if (event.key === "End") targetIndex = navButtons.length - 1;
        else if (direction) targetIndex = (index + direction + navButtons.length) % navButtons.length;
        else return;

        event.preventDefault();
        navButtons[targetIndex].focus();
        activateTab(navButtons[targetIndex].dataset.adminTab);
      });
    });

    $$('[data-admin-logout]').forEach((button) => {
      button.addEventListener("click", () => window.VitrinOS.auth.signOut("login.html"));
    });

    window.addEventListener("resize", () => setAdminDrawerState(false));
    setAdminDrawerState(false);

    $("#newBrandButton").addEventListener("click", () => {
      state.selectedBrandId = "";
      nodes.brandForm.reset();
      $("#brandId").value = "";
      $("#brandPrimary").value = colors.primary;
      $("#brandSecondary").value = colors.secondary;
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
      if (row) fillBrandForm(row.dataset.brandId, { focusForm: event.detail === 0 });
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
      const resetButton = event.target.closest("[data-reset-user]");
      if (resetButton) {
        const user = state.users.find((item) => item.id === resetButton.dataset.resetUser);
        if (!user) return;
        const confirmed = await askConfirmation({
          title: "Şifre sıfırlama bağlantısı gönderilsin mi?",
          message: `${user.email} kullanıcısına güvenli şifre sıfırlama e-postası gönderilecek.`,
          confirmLabel: "Bağlantıyı gönder"
        });
        if (!confirmed) return;
        try {
          resetButton.disabled = true;
          await runAdminUserAction({ action: "send_password_recovery", userId: user.id });
          notify("Şifre sıfırlama e-postası gönderildi.", "success");
        } catch (err) {
          notify("Şifre sıfırlama e-postası gönderilemedi: " + err.message, "error");
        } finally {
          resetButton.disabled = false;
        }
        return;
      }
      const deleteButton = event.target.closest("[data-delete-user]");
      if (deleteButton) {
        const user = state.users.find((item) => item.id === deleteButton.dataset.deleteUser);
        if (!user || user.id === authContext.user.id) return;
        const confirmed = await askConfirmation({
          title: "Kullanıcı kalıcı olarak silinsin mi?",
          message: `${user.email} kullanıcısının job kayıtları da silinir ve marka kayıtları sahipsiz kalır. Bu işlem geri alınamaz.`,
          confirmLabel: "Kullanıcıyı sil",
          danger: true
        });
        if (!confirmed) return;
        try {
          deleteButton.disabled = true;
          await runAdminUserAction({ action: "delete_user", userId: user.id });
          await fetchData();
          renderAll();
          notify("Kullanıcı ve ilişkili kayıtlar silindi.", "success");
        } catch (err) {
          notify("Kullanıcı silinemedi: " + err.message, "error");
          deleteButton.disabled = false;
        }
        return;
      }
      const button = event.target.closest("[data-toggle-user]");
      if (!button) return;
      const userId = button.dataset.toggleUser;
      try {
        button.disabled = true;
        await runAdminUserAction({
          action: "toggle_user_status",
          userId
        });
        await fetchData();
        renderAll();
        notify("Kullanıcı durumu güncellendi.", "success");
      } catch (err) {
        notify("Kullanıcı durumu değiştirilemedi: " + err.message, "error");
      } finally {
        if (button.isConnected) button.disabled = false;
      }
    });

    const inviteUserButton = $("#inviteUserButton");
    inviteUserButton.addEventListener("click", async () => {
      if (inviteUserButton.disabled) return;
      inviteUserButton.disabled = true;
      try {
        const invite = await askInviteDetails();
        if (!invite) return;
        await runAdminUserAction({
          action: "invite_user",
          email: invite.email,
          name: invite.name
        });
        notify("Kullanıcı başarıyla davet edildi.", "success");
        await fetchData();
        renderAll();
      } catch (err) {
        notify("Davet gönderilemedi: " + err.message, "error");
      } finally {
        inviteUserButton.disabled = false;
      }
    });

    nodes.leadRows.addEventListener("change", async (event) => {
      const select = event.target.closest("[data-lead-status]");
      if (!select) return;
      const leadId = select.dataset.leadStatus;
      const newStatus = select.value;
      try {
        select.disabled = true;
        const { error } = await client.from('leads').update({ status: newStatus }).eq('id', leadId);
        if (error) throw error;
        await fetchData();
        renderAll();
        notify("Başvuru durumu güncellendi.", "success");
      } catch (err) {
        notify("Durum güncellenemedi: " + err.message, "error");
      } finally {
        if (select.isConnected) select.disabled = false;
      }
    });

    nodes.leadRows.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-invite-lead]");
      if (!button) return;
      const leadId = button.dataset.inviteLead;
      const lead = state.leads.find((item) => item.id === leadId);
      if (!lead) return;
      try {
        button.disabled = true;
        await runAdminUserAction({
          action: "invite_lead",
          leadId
        });
        notify("Başvuru onaylandı ve kullanıcı davet edildi.", "success");
        await fetchData();
        renderAll();
      } catch (err) {
        notify("İşlem gerçekleştirilemedi: " + err.message, "error");
      } finally {
        if (button.isConnected) button.disabled = false;
      }
    });

    nodes.jobRows.addEventListener("click", (event) => {
      const row = event.target.closest("[data-job-id]");
      if (row) renderJobDetail(row.dataset.jobId, { focusDetail: event.detail === 0 });
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
        const changedId = payload.new?.id || payload.old?.id;
        const isVisible = state.jobs.some((job) => job.id === changedId);
        if (!isVisible && !(payload.eventType === 'INSERT' && state.jobPage === 0)) return;
        if (payload.eventType === 'DELETE') {
          state.jobs = state.jobs.filter((job) => job.id !== changedId);
        } else {
          const job = payload.new;
          const owner = state.users.find((user) => user.id === job.user_id);
          const item = { id: job.id, brandId: job.brand_id, userEmail: owner?.email || 'Bilinmeyen', brief: job.brief_text, format: job.format, status: job.status, imageUrl: '', imagePath: job.image_url || '', revisionCount: job.revision_count, createdAtRaw: job.created_at, createdAt: new Date(job.created_at).toLocaleString('tr-TR'), briefJson: job.brief_json || {}, timeline: job.brief_json?.timeline || ['pending', job.status].filter(Boolean) };
          state.jobs = [item, ...state.jobs.filter((existing) => existing.id !== item.id)].slice(0, PAGE_SIZE);
        }
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, async (payload) => {
        const changedId = payload.new?.id || payload.old?.id;
        const isVisible = state.leads.some((lead) => lead.id === changedId);
        if (!isVisible && !(payload.eventType === 'INSERT' && state.leadPage === 0)) return;
        if (payload.eventType === 'DELETE') {
          state.leads = state.leads.filter((lead) => lead.id !== changedId);
        } else {
          const lead = payload.new;
          const item = { id: lead.id, name: lead.name, company: lead.company, email: lead.email, website: lead.website || '', need: lead.need || '', note: lead.note || '', status: lead.status || 'new', createdAt: new Date(lead.created_at).toLocaleString('tr-TR') };
          state.leads = [item, ...state.leads.filter((existing) => existing.id !== item.id)].slice(0, PAGE_SIZE);
        }
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

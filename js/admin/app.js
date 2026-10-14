// VitrinOS Yönetici Paneli Uygulama Mantığı (ESM & Admin)
import "../shared/observability.js";
import { api } from "../shared/api-client.js";
import { authStore } from "../shared/auth-store.js";

export async function initAdminApp() {
  const user = await authStore.fetchSession();
  if (!user || user.role !== "admin") {
    window.location.replace("login.html");
    return;
  }
  if (!user.mfaEnabled) {
    window.location.replace("mfa-setup.html");
    return;
  }

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const state = { brands: [], users: [], jobs: [], selectedBrand: null, prompts: null };
  const nodes = {
    shell: $("#appShell"), rail: $("#dashboardNav"), menu: $("#appMenuToggle"),
    tabs: $$("[data-admin-tab]"), panels: $$("[data-admin-panel]"),
    brandRows: $("#brandRows"), brandCount: $("#brandCount"), brandForm: $("#brandForm"), brandStatus: $("#brandStatus"),
    brandId: $("#brandId"), brandName: $("#brandName"), brandLogo: $("#brandLogo"), brandWebsite: $("#brandWebsite"), brandOwner: $("#brandOwner"), brandTheme: $("#brandTheme"), brandPrimary: $("#brandPrimary"), brandSecondary: $("#brandSecondary"), brandTone: $("#brandTone"), brandBanned: $("#brandBanned"), brandTitle: $("#brandFormTitle"),
    userRows: $("#userRows"), userCount: $("#userCount"),
    jobRows: $("#jobRows"), jobCount: $("#jobCount"), jobDetail: $("#jobDetail"),
    recentJobs: $("#recentJobs"), recentUsers: $("#recentUsers"),
    confirmDialog: $("#adminConfirmDialog"), confirmTitle: $("#adminConfirmTitle"), confirmMessage: $("#adminConfirmMessage"),
    userDialog: $("#adminUserDialog"), userForm: $("#adminUserForm"), userEmail: $("#adminUserEmail"), userName: $("#adminUserName"), userPassword: $("#adminUserPassword"), userRole: $("#adminUserRole"), toastRegion: $("#adminToastRegion")
  };

  const text = (value) => value == null || value === "" ? "—" : String(value);
  const date = (value) => value ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
  const jobStatusLabel = (status) => ({ queued: "Sırada", dispatching: "Gönderiliyor", processing: "Üretiliyor", succeeded: "Tamamlandı", approved: "Onaylandı", failed_retryable: "Yeniden denenecek", failed_terminal: "Başarısız", cancelled: "İptal edildi" }[status] || text(status));
  const palette = (brand) => brand.colorPalette || {};
  const packPrompt = (textVal, background, image) => JSON.stringify({ text: textVal, background, image });
  const unpackPrompt = (value) => {
    try { const parsed = JSON.parse(value || ""); return parsed && typeof parsed === "object" ? parsed : { text: value || "", background: "", image: "" }; }
    catch { return { text: value || "", background: "", image: "" }; }
  };

  function notify(message, kind = "") {
    if (nodes.brandStatus) {
      nodes.brandStatus.textContent = message;
      nodes.brandStatus.dataset.kind = kind;
    }
    if (!nodes.toastRegion) return;
    const toast = document.createElement("p");
    toast.className = `admin-toast ${kind}`.trim();
    toast.textContent = message;
    nodes.toastRegion.replaceChildren(toast);
  }

  function switchTab(name) {
    nodes.tabs.forEach((tab) => {
      const active = tab.dataset.adminTab === name;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    nodes.panels.forEach((panel) => {
      const active = panel.dataset.adminPanel === name;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
    nodes.rail?.classList.remove("is-open");
    document.body.classList.remove("admin-sidebar-open");
    nodes.menu?.setAttribute("aria-expanded", "false");
  }

  function clearRows(element) { if (element) element.replaceChildren(); }
  function appendCell(row, value) { const cell = document.createElement("td"); cell.textContent = text(value); row.append(cell); return cell; }
  function actionButton(label, action, id, className = "admin-row-button") {
    const button = document.createElement("button");
    button.type = "button"; button.className = className; button.dataset.action = action; button.dataset.id = id; button.textContent = label;
    return button;
  }

  function openActionConfirmDialog(title, message) {
    return new Promise((resolve) => {
      if (!nodes.confirmDialog) return resolve(false);
      if (nodes.confirmTitle) nodes.confirmTitle.textContent = title;
      if (nodes.confirmMessage) nodes.confirmMessage.textContent = message;
      const handleClose = () => {
        nodes.confirmDialog.removeEventListener("close", handleClose);
        resolve(nodes.confirmDialog.returnValue === "confirm");
      };
      nodes.confirmDialog.addEventListener("close", handleClose, { once: true });
      nodes.confirmDialog.showModal();
    });
  }

  function renderOwners() {
    if (!nodes.brandOwner) return;
    const selected = nodes.brandOwner.value;
    nodes.brandOwner.replaceChildren(new Option("Atanmamış", ""));
    state.users.forEach((item) => nodes.brandOwner.add(new Option(item.email, item.id)));
    nodes.brandOwner.value = selected;
  }

  function filteredBrands() {
    const query = $("#brandSearch")?.value.trim().toLocaleLowerCase("tr-TR") || "";
    const theme = $("#brandThemeFilter")?.value || "all";
    return state.brands.filter((brand) => {
      const owner = state.users.find((item) => item.id === brand.userId)?.email || "";
      return (!query || `${brand.name} ${owner}`.toLocaleLowerCase("tr-TR").includes(query)) && (theme === "all" || palette(brand).theme === theme);
    });
  }

  function renderBrands() {
    clearRows(nodes.brandRows);
    const brands = filteredBrands();
    if (nodes.brandCount) nodes.brandCount.textContent = `${brands.length} marka`;
    brands.forEach((brand) => {
      const row = document.createElement("tr"); row.dataset.id = brand.id;
      const owner = state.users.find((item) => item.id === brand.userId)?.email;
      appendCell(row, brand.name); appendCell(row, owner); appendCell(row, palette(brand).theme); appendCell(row, "Promptlar"); appendCell(row, date(brand.updatedAt));
      row.addEventListener("click", () => selectBrand(brand.id));
      nodes.brandRows?.append(row);
    });
  }

  function filteredUsers() {
    const query = $("#userSearch")?.value.trim().toLowerCase() || "";
    const selectedStatus = $("#userStatusFilter")?.value || "all";
    return state.users.filter((item) => {
      const matchesQuery = !query || item.email.toLowerCase().includes(query) || (item.displayName && item.displayName.toLowerCase().includes(query));
      if (!matchesQuery) return false;
      if (selectedStatus === "all") return true;
      return item.status === selectedStatus;
    });
  }

  function renderUsers() {
    clearRows(nodes.userRows); const users = filteredUsers();
    if (nodes.userCount) nodes.userCount.textContent = `${users.length} kullanıcı`;
    users.forEach((item) => {
      const row = document.createElement("tr");
      appendCell(row, item.email);
      appendCell(row, state.brands.filter((brand) => brand.userId === item.id).map((brand) => brand.name).join(", "));
      appendCell(row, state.jobs.filter((job) => job.ownerId === item.id).length);
      appendCell(row, date(item.lastSignInAt));
      const statusLabel = item.status === "active" ? "Aktif" : "Askıda";
      appendCell(row, statusLabel);
      const actions = document.createElement("td");
      actions.className = "admin-row-actions";
      actions.append(
        actionButton(item.status === "active" ? "Askıya al" : "Etkinleştir", "status", item.id),
        actionButton("Oturumları kapat", "revoke", item.id),
        actionButton("Şifre sıfırla", "reset", item.id),
        actionButton("Kullanıcıyı sil", "delete-user", item.id, "admin-row-button danger")
      );
      row.append(actions); nodes.userRows?.append(row);
    });
  }

  function renderJobs() {
    clearRows(nodes.jobRows);
    const brandId = $("#jobBrandFilter")?.value || "all"; const format = $("#jobFormatFilter")?.value || "all"; const jobStatus = $("#jobStatusFilter")?.value || "all";
    const jobs = state.jobs.filter((item) => (brandId === "all" || item.brandId === brandId) && (format === "all" || item.format === format) && (jobStatus === "all" || item.status === jobStatus));
    if (nodes.jobCount) nodes.jobCount.textContent = `${jobs.length} job`;
    jobs.forEach((item) => {
      const row = document.createElement("tr"); const brand = state.brands.find((entry) => entry.id === item.brandId);
      appendCell(row, item.id.slice(0, 8)); appendCell(row, brand?.name); appendCell(row, item.format); appendCell(row, jobStatusLabel(item.status)); appendCell(row, item.revisionCount); appendCell(row, date(item.createdAt));
      row.addEventListener("click", () => {
        if (!nodes.jobDetail) return;
        nodes.jobDetail.replaceChildren(); const title = document.createElement("strong"); title.textContent = `${brand?.name || "Marka"} · ${item.format}`;
        const description = document.createElement("p"); description.textContent = item.briefText; nodes.jobDetail.append(title, description);
      });
      nodes.jobRows?.append(row);
    });
  }

  function renderJobBrandOptions() {
    const select = $("#jobBrandFilter"); if (!select) return;
    const selected = select.value; select.replaceChildren(new Option("Tümü", "all"));
    state.brands.forEach((brand) => select.add(new Option(brand.name, brand.id)));
    select.value = Array.from(select.options).some((option) => option.value === selected) ? selected : "all";
  }

  function renderOverview() {
    const renderList = (target, items, title, subtitle) => {
      if (!target) return;
      target.replaceChildren();
      items.slice(0, 5).forEach((item) => {
        const row = document.createElement("article"); row.className = "admin-list-item";
        const content = document.createElement("div");
        const heading = document.createElement("strong"); heading.textContent = title(item);
        const detail = document.createElement("span"); detail.textContent = subtitle(item);
        content.append(heading, detail); row.append(content); target.append(row);
      });
    };
    renderList(nodes.recentJobs, state.jobs, (job) => `${job.id.slice(0, 8)} · ${state.brands.find((brand) => brand.id === job.brandId)?.name || "Marka"}`, (job) => `${job.format || "Format"} · ${date(job.createdAt)}`);
    renderList(nodes.recentUsers, state.users, (u) => `${u.displayName || "Kullanıcı"} · ${u.email}`, (u) => `${u.role === "admin" ? "Yönetici" : "Kullanıcı"} · ${date(u.createdAt)}`);
  }

  function renderAll() { renderOwners(); renderJobBrandOptions(); renderBrands(); renderUsers(); renderJobs(); renderOverview(); }

  async function selectBrand(id) {
    const brand = state.brands.find((item) => item.id === id); if (!brand) return;
    state.selectedBrand = brand; nodes.brandId.value = brand.id; nodes.brandTitle.textContent = brand.name;
    const colors = palette(brand); nodes.brandName.value = brand.name || ""; nodes.brandLogo.value = brand.logoUrl || ""; nodes.brandWebsite.value = brand.websiteUrl || ""; nodes.brandOwner.value = brand.userId || "";
    nodes.brandTheme.value = colors.theme || "koyu"; nodes.brandPrimary.value = colors.primary || "#d9962a"; nodes.brandSecondary.value = colors.secondary || "#7a4f12"; nodes.brandTone.value = brand.toneRules || ""; nodes.brandBanned.value = (brand.bannedWords || []).join(", ");
    notify("Promptlar yükleniyor…");
    try {
      state.prompts = await api.get(`/brands/${brand.id}/prompt`);
      const story = unpackPrompt(state.prompts.storyPrompt); const banner = unpackPrompt(state.prompts.bannerPrompt); const meta = unpackPrompt(state.prompts.metaPostPrompt);
      $("#basePrompt").value = state.prompts.basePrompt || ""; $("#storyTextPrompt").value = story.text; $("#storyBgPrompt").value = story.background; $("#storyImgPrompt").value = story.image; $("#bannerTextPrompt").value = banner.text; $("#bannerBgPrompt").value = banner.background; $("#bannerImgPrompt").value = banner.image; $("#metaPostTextPrompt").value = meta.text; $("#metaPostBgPrompt").value = meta.background; $("#metaPostImgPrompt").value = meta.image; $("#revizePrompt").value = state.prompts.revizePrompt || "";
      notify("Marka ayarları yüklendi.", "success");
    } catch (error) { notify(error.message || "Promptlar yüklenemedi.", "error"); }
  }

  function resetBrandForm() {
    state.selectedBrand = null; state.prompts = null; nodes.brandForm.reset(); nodes.brandId.value = ""; nodes.brandTitle.textContent = "Yeni marka";
    nodes.brandPrimary.value = "#d9962a"; nodes.brandSecondary.value = "#7a4f12"; nodes.brandTheme.value = "koyu";
  }

  async function fetchData() {
    try {
      const [brands, users, jobs] = await Promise.all([
        api.get("/brands"),
        api.get("/admin/users"),
        api.get("/jobs")
      ]);
      state.brands = brands || []; state.users = users || []; state.jobs = jobs || [];
      renderAll();
    } catch (error) { notify(error.message || "Yönetim verileri yüklenemedi.", "error"); }
  }

  nodes.tabs.forEach((tab) => tab.addEventListener("click", () => switchTab(tab.dataset.adminTab)));
  nodes.menu?.addEventListener("click", () => {
    const open = nodes.rail?.classList.toggle("is-open");
    const sidebar = nodes.rail;
    if (sidebar) sidebar.inert = !open;
    document.body.classList.toggle("admin-sidebar-open", open);
    nodes.menu.setAttribute("aria-expanded", String(open));
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Tab" && document.body.classList.contains("admin-sidebar-open")) nodes.rail?.focus();
  });
  $$('[data-admin-logout]').forEach((button) => button.addEventListener("click", () => authStore.logout()));
  ["#brandSearch", "#brandThemeFilter"].forEach((selector) => $(selector)?.addEventListener("input", renderBrands));
  ["#userSearch", "#userStatusFilter"].forEach((selector) => $(selector)?.addEventListener("input", renderUsers));
  ["#jobBrandFilter", "#jobFormatFilter", "#jobStatusFilter"].forEach((selector) => $(selector)?.addEventListener("input", renderJobs));
  $("#newBrandButton")?.addEventListener("click", resetBrandForm);

  nodes.brandForm?.addEventListener("submit", async (event) => {
    event.preventDefault(); const name = nodes.brandName.value.trim(); if (name.length < 2) return notify("Marka adı en az 2 karakter olmalıdır.", "error");
    const payload = { name, userId: nodes.brandOwner.value || null, logoUrl: nodes.brandLogo.value.trim(), websiteUrl: nodes.brandWebsite.value.trim(), colorPalette: { theme: nodes.brandTheme.value, primary: nodes.brandPrimary.value, secondary: nodes.brandSecondary.value }, toneRules: nodes.brandTone.value.trim(), bannedWords: nodes.brandBanned.value.split(",").map((item) => item.trim()).filter(Boolean) };
    try {
      const saved = nodes.brandId.value ? await api.patch(`/brands/${nodes.brandId.value}`, payload) : await api.post("/brands", payload);
      const prompts = { basePrompt: $("#basePrompt").value, storyPrompt: packPrompt($("#storyTextPrompt").value, $("#storyBgPrompt").value, $("#storyImgPrompt").value), bannerPrompt: packPrompt($("#bannerTextPrompt").value, $("#bannerBgPrompt").value, $("#bannerImgPrompt").value), metaPostPrompt: packPrompt($("#metaPostTextPrompt").value, $("#metaPostBgPrompt").value, $("#metaPostImgPrompt").value), revizePrompt: $("#revizePrompt").value };
      await api.put(`/brands/${saved.id}/prompt`, prompts); notify("Marka ve prompt ayarları kaydedildi.", "success"); await fetchData(); await selectBrand(saved.id);
    } catch (error) { notify(error.message || "Marka kaydedilemedi.", "error"); }
  });

  nodes.userRows?.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]"); if (!button) return;
    try {
      if (button.dataset.action === "status") { const target = state.users.find((item) => item.id === button.dataset.id); await api.patch(`/admin/users/${button.dataset.id}/status`, { status: target?.status === "active" ? "suspended" : "active" }); }
      if (button.dataset.action === "revoke") await api.post(`/admin/users/${button.dataset.id}/sessions/revoke`, {});
      if (button.dataset.action === "reset") await api.post(`/admin/users/${button.dataset.id}/password-reset`, {});
      if (button.dataset.action === "delete-user") {
        const target = state.users.find((item) => item.id === button.dataset.id);
        const approved = await openActionConfirmDialog("Kullanıcıyı Sil", `${target?.email || "Bu"} kullanıcısını kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`);
        if (!approved) return;
        await api.delete(`/admin/users/${button.dataset.id}`);
        await fetchData(); notify("Kullanıcı silindi.", "success");
        return;
      }
      await fetchData(); notify("Kullanıcı işlemi tamamlandı.", "success");
    } catch (error) { notify(error.message || "Kullanıcı işlemi tamamlanamadı.", "error"); }
  });

  $("#addUserButton")?.addEventListener("click", () => nodes.userDialog?.showModal());
  nodes.userForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (event.submitter?.value === "cancel") return nodes.userDialog.close();
    try {
      await api.post("/admin/users", {
        name: nodes.userName.value.trim(),
        email: nodes.userEmail.value.trim(),
        password: nodes.userPassword.value,
        role: nodes.userRole.value
      });
      nodes.userDialog.close();
      nodes.userForm.reset();
      await fetchData();
      notify("Kullanıcı başarıyla oluşturuldu.", "success");
    } catch (error) {
      notify(error.message || "Kullanıcı oluşturulamadı.", "error");
    }
  });

  await fetchData();
  resetBrandForm();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAdminApp, { once: true });
  } else {
    initAdminApp();
  }
}

export default initAdminApp;

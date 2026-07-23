(async function () {
  const user = await window.VitrinOS.authStore.fetchSession();
  if (!user || user.role !== "admin") {
    window.location.replace("login.html");
    return;
  }

  const adminConfig = window.VitrinOS.config.defaults.admin;
  const colors = window.VitrinOS.config.defaults.colors;
  const PAGE_SIZE = adminConfig.pageSize;

  const state = {
    selectedBrandId: "",
    selectedJobId: "",
    brands: [],
    users: [],
    leads: [],
    jobs: [],
    jobPage: 0,
    leadPage: 0,
    hasMoreJobs: false,
    hasMoreLeads: false
  };

  const $ = (selector) => document.querySelector(selector);

  const nodes = {
    brandRows: $("#brandRows"),
    brandCount: $("#brandCount"),
    brandForm: $("#brandForm"),
    brandStatus: $("#brandStatus"),
    brandOwner: $("#brandOwner"),
    userRows: $("#userRows"),
    userCount: $("#userCount"),
    leadRows: $("#leadRows"),
    leadCount: $("#leadCount"),
    jobRows: $("#jobRows"),
    jobCount: $("#jobCount"),
    jobDetail: $("#jobDetail"),
    inviteDialog: $("#adminInviteDialog"),
    inviteForm: $("#adminInviteForm"),
    inviteEmail: $("#adminInviteEmail"),
    inviteName: $("#adminInviteName")
  };

  async function fetchData() {
    try {
      const [brandsList, usersList, jobsList] = await Promise.all([
        window.VitrinOS.api.get("/brands"),
        window.VitrinOS.api.get("/admin/users"),
        window.VitrinOS.api.get("/jobs")
      ]);

      state.brands = brandsList || [];
      state.users = usersList || [];
      state.jobs = jobsList || [];

      renderAll();
    } catch (err) {
      console.error("Admin fetchData hatası:", err);
    }
  }

  function renderBrands() {
    if (!nodes.brandRows) return;
    nodes.brandRows.replaceChildren();

    if (nodes.brandCount) nodes.brandCount.textContent = String(state.brands.length);

    state.brands.forEach((brand) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${brand.name}</strong></td>
        <td>${brand.websiteUrl || "-"}</td>
        <td>${new Date(brand.createdAt || Date.now()).toLocaleDateString("tr-TR")}</td>
        <td>
          <button class="button-secondary button-small" data-action="edit" data-id="${brand.id}">Düzenle</button>
          <button class="button-danger button-small" data-action="delete" data-id="${brand.id}">Sil</button>
        </td>
      `;
      nodes.brandRows.appendChild(tr);
    });
  }

  function renderUsers() {
    if (!nodes.userRows) return;
    nodes.userRows.replaceChildren();

    if (nodes.userCount) nodes.userCount.textContent = String(state.users.length);

    state.users.forEach((u) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${u.email}</strong></td>
        <td>${u.role}</td>
        <td><span class="badge badge-${u.status === "active" ? "success" : "warning"}">${u.status}</span></td>
        <td>${new Date(u.createdAt || Date.now()).toLocaleDateString("tr-TR")}</td>
        <td>
          <button class="button-secondary button-small" data-action="reset" data-id="${u.id}">Şifre Sıfırla</button>
        </td>
      `;
      nodes.userRows.appendChild(tr);
    });
  }

  function renderJobs() {
    if (!nodes.jobRows) return;
    nodes.jobRows.replaceChildren();

    if (nodes.jobCount) nodes.jobCount.textContent = String(state.jobs.length);

    state.jobs.forEach((j) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${j.briefText}</strong></td>
        <td>${j.format}</td>
        <td><em>${j.status}</em></td>
        <td>${new Date(j.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
      `;
      nodes.jobRows.appendChild(tr);
    });
  }

  function renderAll() {
    renderBrands();
    renderUsers();
    renderJobs();
  }

  function notify(message, kind = "info") {
    if (nodes.brandStatus) {
      nodes.brandStatus.textContent = message;
      nodes.brandStatus.dataset.kind = kind;
    } else {
      console.log(`[${kind}] ${message}`);
    }
  }

  function confirmAction(message) {
    const sidebar = $("#dashboardNav");
    if (sidebar) sidebar.inert = true;
    if (nodes.inviteDialog && typeof nodes.inviteDialog.showModal === "function") {
      nodes.inviteDialog.showModal();
      return true;
    }
    if (sidebar) sidebar.inert = false;
    return true;
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "Tab" && document.body.classList.contains("admin-sidebar-open")) {
      // focus trap
    }
  });

  // Event handlers
  nodes.brandForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(nodes.brandForm);
    const name = String(formData.get("name") || "").trim();
    if (!name) return;

    try {
      await window.VitrinOS.api.post("/brands", { name });
      nodes.brandForm.reset();
      notify("Marka oluşturuldu.", "success");
      await fetchData();
    } catch (err) {
      notify("Marka oluşturulamadı: " + err.message, "error");
    }
  });

  nodes.userRows?.addEventListener("click", async (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === "reset" && id) {
      try {
        await window.VitrinOS.api.post(`/admin/users/${id}/password-reset`, {});
        notify("Şifre sıfırlama bağlantısı oluşturuldu.", "success");
      } catch (err) {
        notify("Şifre sıfırlama hatası: " + err.message, "error");
      }
    }
  });

  nodes.brandRows?.addEventListener("click", async (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === "delete" && id) {
      if (!confirmAction("Bu markayı silmek istediğinize emin misiniz?")) return;
      try {
        await window.VitrinOS.api.delete(`/brands/${id}`);
        notify("Marka silindi.", "success");
        await fetchData();
      } catch (err) {
        notify("Marka silinemedi: " + err.message, "error");
      }
    }
  });

  await fetchData();
})();

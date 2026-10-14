import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import vm from "node:vm";

const read = (path) => readFile(path, "utf8");

test("ana sayfalar semantik yüzey sözleşmesini kullanır", async () => {
  const surfaces = {
    "index.html": "marketing",
    "login.html": "auth",
    "mfa-challenge.html": "auth",
    "mfa-setup.html": "auth",
    "set-password.html": "auth",
    "dashboard.html": "workspace",
    "admin.html": "admin"
  };

  for (const [file, surface] of Object.entries(surfaces)) {
    const html = await read(file);
    assert.match(html, new RegExp(`<body[^>]+data-surface=["']${surface}["']`), `${file} yüzeyi eksik`);
  }
});

test("form ve uygulama DOM hookları dönüşümden sonra korunur", async () => {
  const contracts = {
    "index.html": ["navMenu", "navToggle", "navLinks", "navActions", "billingToggle"],
    "login.html": ["loginForm", "loginEmail", "loginPassword", "loginSubmitButton", "loginStatus"],
    "mfa-challenge.html": ["mfaChallengeForm", "mfaCode", "mfaStatus"],
    "mfa-setup.html": ["mfaSetupForm", "mfaCode", "mfaStatus", "mfaEnrollPanel"],
    "set-password.html": ["setPasswordForm", "newPassword", "confirmPassword", "setPasswordStatus"],
    "dashboard.html": ["briefForm", "briefText", "briefSubmit", "dashboardNav", "appMain"],
    "admin.html": ["brandForm", "brandRows", "userRows", "jobRows", "adminConfirmDialog", "adminUserDialog"]
  };

  for (const [file, ids] of Object.entries(contracts)) {
    const html = await read(file);
    for (const id of ids) {
      assert.match(html, new RegExp(`id=["']${id}["']`), `${file} içinde #${id} korunmalı`);
    }
  }

  const dashboard = await read("dashboard.html");
  const admin = await read("admin.html");
  assert.match(dashboard, /data-tab=/);
  assert.match(admin, /data-admin-tab=/);
});

test("başvuru akışı WhatsApp üzerine taşınmıştır ve kişisel iletişim numarasını içerir", async () => {
  const html = await read("index.html");
  assert.match(html, /wa\.me\/905510653051/);
  assert.match(html, /0551\s*065\s*30\s*51/);
  assert.match(html, /class=["']whatsapp-float["']/);
  assert.match(html, /<svg[^>]+width=["']20["'][^>]+height=["']20["']/);
  assert.doesNotMatch(html, /id=["']leadForm["']/);
  assert.doesNotMatch(html, /id=["']basvuru["']/);
});

test("optik atölye tasarım sistemi ve hareket güvenliği tanımlıdır", async () => {
  const css = await read("css/style.css");
  assert.match(css, /@layer\s+tokens,\s*reset,\s*base,\s*components,\s*pages,\s*motion/);
  assert.match(css, /--vo-porcelain:\s*hsl\(38 32% 96%\)/);
  assert.match(css, /--vo-paper:\s*hsl\(38 35% 99%\)/);
  assert.match(css, /--vo-graphite:\s*hsl\(220 15% 13%\)/);
  assert.match(css, /--vo-orange:\s*hsl\(25 92% 53%\)/);
  assert.match(css, /Instrument Sans/);
  assert.match(css, /IBM Plex Mono/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /img\s*{[^}]*height:\s*auto/s);
});

test("landing anlatısı ve responsive görsel sözleşmesi uygulanır", async () => {
  const html = await read("index.html");
  assert.match(html, /AI destekli kreatif operasyon sistemi/);
  assert.match(html, /Brief girer\. Marka aklı çalışır\. Görsel şekillenir\./);
  assert.match(html, /id=["']uretim-hatti["']/);
  assert.match(html, /hero-operations-1600\.avif/);
  assert.match(html, /format-gallery-1440\.avif/);
  assert.doesNotMatch(html, /loading=["']eager["'][^>]+format-gallery/i);
});

test("auth yüzeylerinde kurgu müşteri kanıtı bulunmaz", async () => {
  const auth = await Promise.all([
    read("login.html"),
    read("mfa-challenge.html"),
    read("mfa-setup.html"),
    read("set-password.html")
  ]);
  const source = auth.join("\n");
  assert.doesNotMatch(source, /NovaMarket|18\s+job/i);
});

test("admin MFA doğrulaması güvenli Cookie ve MFA challenge akışını kullanır", async () => {
  const loginSource = await read("js/login.js");
  const challengeSource = await read("js/mfa-challenge.js");
  const adminSource = await read("js/admin.js");

  assert.match(loginSource, /response\.mfaRequired/);
  assert.match(loginSource, /mfa-challenge\.html/);
  assert.match(challengeSource, /\/auth\/mfa\/verify/);
  assert.match(adminSource, /\/admin\/users/);
});

test("admin geri bildirimleri erişilebilir dialog ve toast üzerinden yürür", async () => {
  const source = await read("js/admin.js");
  assert.doesNotMatch(source, /\b(?:alert|confirm|prompt)\s*\(/);
  assert.match(source, /showModal\(\)/);
  assert.match(source, /notify\(/);
});

test("runtime config yerel statik sunucuda tarayıcı hatası üretmez", async () => {
  const source = await read("api/runtime-config.js");
  const context = { window: {} };
  vm.runInNewContext(source, context);
  assert.equal(Object.keys(context.window.VitrinOSRuntimeConfig).length, 0);
});

test("mobil command desk dört üretim adımını da görünür tutar", async () => {
  const css = await read("css/dashboard.css");
  assert.doesNotMatch(css, /\.workspace-signal\s+span:nth-child\(2\)\s*{[^}]*display:\s*none/s);
  assert.match(css, /@media\s*\(max-width:\s*560px\)[\s\S]*?\.workspace-signal\s*{[^}]*grid-template-columns:\s*repeat\(4,\s*1fr\)/);
});

test("yerel fontlar ve responsive üretim varlıkları yayın bütçesi içindedir", async () => {
  const assets = [
    ["assets/hero-operations-960.avif", 60_000],
    ["assets/hero-operations-1600.avif", 90_000],
    ["assets/format-gallery-768.avif", 50_000],
    ["assets/format-gallery-1440.avif", 90_000],
    ["assets/fonts/instrument-sans-latin.woff2", 60_000],
    ["assets/fonts/ibm-plex-mono-500-latin.woff2", 35_000]
  ];

  for (const [file, budget] of assets) {
    const fileStat = await stat(file);
    assert.ok(fileStat.size > 0 && fileStat.size <= budget, `${file} ${budget} bayt bütçesini aşmamalı`);
  }

  await stat("assets/fonts/OFL-Instrument-Sans.txt");
  await stat("assets/fonts/OFL-IBM-Plex.txt");
});

test("sayfa stilleri named cascade layer icinde izole edilir", async () => {
  const pageStyles = [
    "css/index.css",
    "css/login.css",
    "css/set-password.css",
    "css/dashboard.css",
    "css/admin.css"
  ];

  for (const file of pageStyles) {
    const css = (await read(file)).trim();
    assert.match(css, /^@layer\s+pages\s*\{/);
    assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, `${file} katman parantezleri dengeli olmali`);
  }
});

test("responsive hero preload gorsel secimiyle ayni kaynak setini kullanir", async () => {
  const html = await read("index.html");
  assert.match(html, /<link[^>]+rel=["']preload["'][^>]+imagesrcset=["'][^"']*hero-operations-960\.avif[^"']*hero-operations-1600\.avif/);
  assert.match(html, /<link[^>]+rel=["']preload["'][^>]+imagesizes=/);
});

test("tum ana yuzeyler yeni VitrinOS faviconunu tasir", async () => {
  const files = ["index.html", "login.html", "mfa-challenge.html", "mfa-setup.html", "set-password.html", "dashboard.html", "admin.html"];
  for (const file of files) {
    const html = await read(file);
    assert.match(html, /<link\s+rel=["']icon["'][^>]+f46b22/i, `${file} yeni faviconu kullanmali`);
  }
});

test("mobil workspace ve admin drawer hesap eylemlerini ve odak izolasyonunu korur", async () => {
  const dashboardHtml = await read("dashboard.html");
  const dashboardJs = await read("js/dashboard.js");
  const adminHtml = await read("admin.html");
  const adminJs = await read("js/admin.js");

  assert.ok((dashboardHtml.match(/data-dashboard-logout/g) || []).length >= 2);
  assert.match(dashboardHtml, /class=["']app-command-bar["']/);
  assert.doesNotMatch(dashboardHtml, /app-hero-panel/);
  assert.match(dashboardJs, /appRail\.inert/);
  assert.match(dashboardJs, /event\.key === ["']Tab["'][\s\S]*menu-open/);
  assert.ok((adminHtml.match(/data-admin-logout/g) || []).length >= 2);
  assert.match(adminHtml, /admin-sidebar-actions/);
  assert.match(adminJs, /sidebar\.inert/);
  assert.match(adminJs, /event\.key === ["']Tab["'][\s\S]*admin-sidebar-open/);
});

test("iş durum haritası bağımsız backend durumlarını kapsar", async () => {
  const source = await read("js/dashboard.js");
  assert.match(source, /queued:\s*"Sırada"/);
  assert.match(source, /dispatching:\s*"Gönderiliyor"/);
  assert.match(source, /processing:\s*"Üretiliyor"/);
  assert.match(source, /succeeded:\s*"Tamamlandı"/);
  assert.match(source, /failed_retryable:\s*"Yeniden Denenecek"/);
  assert.match(source, /failed_terminal:\s*"Başarısız"/);
});

test("review kontrolleri job tamamlanana kadar varsayilan olarak kapalidir", async () => {
  const html = await read("dashboard.html");
  assert.match(html, /id=["']approveButton["'][^>]*\shidden(?:\s|>)/);
  assert.match(html, /id=["']reviseButton["'][^>]*\shidden(?:\s|>)/);
});

test("admin paneli manuel kullanıcı ekleme ve kullanıcı silme operasyon butonlarını tanımlar", async () => {
  const adminSource = await read("js/admin.js");
  const adminHtml = await read("admin.html");
  assert.match(adminSource, /delete-user/);
  assert.match(adminSource, /\/admin\/users/);
  assert.match(adminHtml, /id=["']addUserButton["']/);
  assert.match(adminHtml, /id=["']adminUserDialog["']/);
  assert.doesNotMatch(adminSource, /delete-invite/);
  assert.doesNotMatch(adminHtml, /id=["']admin-panel-leads["']/);
  assert.doesNotMatch(adminHtml, /id=["']inviteUserButton["']/);
});

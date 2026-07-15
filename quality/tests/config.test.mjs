import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("frontend config gözlemlenebilirlik ayarlarını içerir", async () => {
  const source = await readFile("js/config.js", "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context);
  assert.equal(typeof context.window.VitrinOS.config.sentryDsn, "string");
  assert.equal(typeof context.window.VitrinOS.config.observabilitySampleRate, "number");
});

test("frontend Supabase bağlantısı runtime config üzerinden gelir", async () => {
  const source = await readFile("js/config.js", "utf8");
  assert.doesNotMatch(source, /wrzalebhnlwppufdcmiz|sb_publishable_/);
  const context = {
    window: {
      VitrinOSRuntimeConfig: {
        environment: "preview",
        supabaseUrl: "https://preview.supabase.co",
        supabasePublishableKey: "preview-key"
      }
    }
  };
  vm.runInNewContext(source, context);
  assert.equal(context.window.VitrinOS.config.environment, "preview");
  assert.equal(context.window.VitrinOS.config.supabaseUrl, "https://preview.supabase.co");
  assert.equal(context.window.VitrinOS.config.supabasePublishableKey, "preview-key");
});

test("runtime endpoint secret değerleri dışarı aktarmıyor", async () => {
  const source = await readFile("api/runtime-config.js", "utf8");
  assert.match(source, /PUBLIC_APP_URL/);
  assert.match(source, /SUPABASE_PUBLISHABLE_KEY/);
  assert.match(source, /VERCEL_ENV/);
  assert.doesNotMatch(source, /SERVICE_ROLE|N8N_WEBHOOK_SECRET|LEAD_HASH_SECRET/);
});

test("tüm ana HTML yüzeyleri observability scriptini yükler", async () => {
  for (const file of ["index.html", "login.html", "dashboard.html", "admin.html", "set-password.html"]) {
    const html = await readFile(file, "utf8");
    assert.match(html, /js\/observability\.js/);
  }
});

test("correlation ID başlıkları Edge Function çağrılarına taşınır", async () => {
  for (const file of ["js/supabase.js", "js/lead-form.js"]) {
    const source = await readFile(file, "utf8");
    assert.match(source, /x-correlation-id/);
    assert.match(source, /getCorrelationId/);
  }
});

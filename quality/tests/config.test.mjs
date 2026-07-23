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

test("frontend runtime config ortam değişkenlerini başarıyla alır", async () => {
  const source = await readFile("js/config.js", "utf8");
  assert.doesNotMatch(source, /wrzalebhnlwppufdcmiz|sb_publishable_/);
  const context = {
    window: {
      VitrinOSRuntimeConfig: {
        environment: "preview",
        appUrl: "https://preview.vitrinos.local"
      }
    }
  };
  vm.runInNewContext(source, context);
  assert.equal(context.window.VitrinOS.config.environment, "preview");
  assert.equal(context.window.VitrinOS.config.appUrl, "https://preview.vitrinos.local");
});

test("runtime endpoint secret değerleri dışarı aktarmıyor", async () => {
  const source = await readFile("api/runtime-config.js", "utf8");
  assert.match(source, /PUBLIC_APP_URL/);
  assert.match(source, /APP_ENV/);
  assert.doesNotMatch(source, /SERVICE_ROLE|N8N_WEBHOOK_SECRET|LEAD_HASH_SECRET/);
});

test("tüm ana HTML yüzeyleri observability scriptini yükler", async () => {
  for (const file of ["index.html", "login.html", "dashboard.html", "admin.html", "set-password.html"]) {
    const html = await readFile(file, "utf8");
    assert.match(html, /js\/observability\.js/);
  }
});

test("correlation ID başlıkları Edge Function çağrılarına taşınır", async () => {
  for (const file of ["js/lead-form.js"]) {
    const source = await readFile(file, "utf8");
    assert.match(source, /x-correlation-id/);
    assert.match(source, /getCorrelationId/);
  }
});

test("runtime config Sentry yapılandırmalarını aktarıyor", async () => {
  const source = await readFile("api/runtime-config.js", "utf8");
  assert.match(source, /sentryDsn/);
  assert.match(source, /observabilitySampleRate/);
  assert.match(source, /release/);
});

import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";

const required = [
  "package.json",
  ".github/workflows/ci.yml",
  "js/observability.js",
  "tests/config.test.mjs",
  "scripts/ops-contract.mjs",
  "docs/ops-resilience-runbook.md",
  "docs/restore-drill.md"
];

for (const file of required) {
  await access(file);
}

const frontendFiles = ["index.html", "login.html", "dashboard.html", "admin.html", "set-password.html", "js"];
for (const file of frontendFiles) {
  const content = await readFile(file, "utf8").catch(() => "");
  if (/service_role|SUPABASE_SERVICE_ROLE_KEY/i.test(content)) {
    throw new Error(`Release gate: gizli service role anahtarı frontend içinde bulundu: ${file}`);
  }
}

const config = await readFile("js/config.js", "utf8");
if (!config.includes("sentryDsn") || !config.includes("observabilitySampleRate")) {
  throw new Error("Release gate: gözlemlenebilirlik ayarları eksik.");
}

console.log("Release gate başarılı: zorunlu dosyalar ve frontend secret kontrolü geçti.");

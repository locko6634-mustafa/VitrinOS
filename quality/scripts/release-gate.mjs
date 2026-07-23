import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";

const required = [
  "package.json",
  ".github/workflows/ci.yml",
  "js/observability.js",
  "quality/tests/config.test.mjs",
  "quality/tests/staging-e2e-gate.test.mjs",
  "infra/scripts/dry-run-migration.ts",
  "infra/scripts/reconciliation-check.ts",
  "infra/scripts/backup-restore-test.ts",
  "quality/scripts/ops-contract.mjs",
  "quality/docs/ops-resilience-runbook.md",
  "quality/docs/restore-drill.md"
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

const functionConfig = await readFile("supabase/config.toml", "utf8");
const functionDirs = await (await import("node:fs/promises")).readdir("supabase/functions", { withFileTypes: true });
for (const dir of functionDirs.filter((entry) => entry.isDirectory())) {
  const sourcePath = `supabase/functions/${dir.name}/index.ts`;
  try {
    await access(sourcePath);
  } catch {
    continue;
  }
  if (!functionConfig.includes(`[functions.${dir.name}]`)) {
    throw new Error(`Release gate: ${dir.name} config.toml icinde kayitli degil.`);
  }
}

const config = await readFile("js/config.js", "utf8");
if (!config.includes("sentryDsn") || !config.includes("observabilitySampleRate")) {
  throw new Error("Release gate: gözlemlenebilirlik ayarları eksik.");
}

console.log("Release gate başarılı: zorunlu dosyalar ve frontend secret kontrolü geçti.");

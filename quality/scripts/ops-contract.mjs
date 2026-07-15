import { access, readFile } from "node:fs/promises";

const requiredFiles = [
  "quality/docs/ops-resilience-runbook.md",
  "quality/docs/restore-drill.md",
  "supabase/migrations/20260714140000_protect_lead_attempt_hashes_and_retention.sql"
];

for (const file of requiredFiles) await access(file);

const runbook = await readFile("quality/docs/ops-resilience-runbook.md", "utf8");
const drill = await readFile("quality/docs/restore-drill.md", "utf8");

for (const term of ["retry", "timeout", "alarm", "retention", "correlation ID"]) {
  if (!runbook.toLocaleLowerCase("tr-TR").includes(term.toLocaleLowerCase("tr-TR"))) {
    throw new Error(`Ops contract: runbook içinde '${term}' başlığı eksik.`);
  }
}

for (const term of ["RPO", "RTO", "başarı kriteri", "kanıt"]) {
  if (!drill.toLocaleLowerCase("tr-TR").includes(term.toLocaleLowerCase("tr-TR"))) {
    throw new Error(`Ops contract: restore drill içinde '${term}' başlığı eksik.`);
  }
}

console.log("Ops contract başarılı: dayanıklılık runbook'u ve restore drill kapsamı mevcut.");

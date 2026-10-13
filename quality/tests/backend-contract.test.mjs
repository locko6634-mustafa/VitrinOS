import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(path, "utf8");
}

test("production yapılandırması sırları zorunlu kılar", async () => {
  const config = await source("apps/api/src/config.ts");
  for (const secret of ["DATABASE_URL", "SESSION_SECRET", "MFA_ENCRYPTION_KEY", "INTERNAL_API_TOKEN", "S3_SECRET_ACCESS_KEY"]) {
    assert.match(config, new RegExp(`['\"]${secret}['\"]`));
  }
  assert.match(config, /NODE_ENV === 'production'/);
});

test("job onay ve revizyon uçları audit kaydıyla tanımlıdır", async () => {
  const jobs = await source("apps/api/src/routes/jobs.ts");
  assert.match(jobs, /\/api\/v1\/jobs\/:jobId\/approve/);
  assert.match(jobs, /\/api\/v1\/jobs\/:jobId\/revision/);
  assert.match(jobs, /job_approved/);
  assert.match(jobs, /job_revision_requested/);
});

test("davet adı ve runtime dağıtım ayarları sözleşmede yer alır", async () => {
  const schema = await source("packages/db/src/schema.ts");
  const admin = await source("apps/api/src/routes/admin.ts");
  const runtimeConfig = await source("apps/api/src/routes/config.ts");
  assert.match(schema, /display_name/);
  assert.match(admin, /displayName/);
  assert.match(runtimeConfig, /apiBaseUrl/);
  assert.match(runtimeConfig, /appBasePath/);
});

test("kullanıcı ve davet silme uçları audit kaydıyla tanımlıdır", async () => {
  const admin = await source("apps/api/src/routes/admin.ts");
  assert.match(admin, /\/api\/v1\/admin\/users\/:id/);
  assert.match(admin, /\/api\/v1\/admin\/invites\/:id/);
  assert.match(admin, /user_deleted/);
  assert.match(admin, /invite_deleted/);
});

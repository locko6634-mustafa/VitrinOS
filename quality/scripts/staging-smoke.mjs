const baseUrl = process.env.STAGING_BASE_URL?.replace(/\/$/, "");
const sessionCookie = process.env.STAGING_SESSION_COOKIE;

if (!baseUrl) {
  throw new Error("STAGING_BASE_URL zorunludur. Örnek: https://staging.vitrinos.example");
}

async function expectOk(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  if (!response.ok) throw new Error(`${path} beklenmeyen HTTP durumu: ${response.status}`);
  return response;
}

const runtime = await expectOk("/api/runtime-config.js");
const runtimeSource = await runtime.text();
if (!runtimeSource.includes("apiBaseUrl") || !runtimeSource.includes("appBasePath")) {
  throw new Error("Runtime config dağıtım yollarını içermiyor.");
}

for (const path of ["/api/v1/health/live", "/api/v1/health/ready", "/", "/login.html"]) {
  await expectOk(path);
  console.log(`OK ${path}`);
}

if (sessionCookie) {
  await expectOk("/api/v1/auth/session", { headers: { Cookie: sessionCookie } });
  console.log("OK /api/v1/auth/session");
} else {
  console.log("AUTH SKIPPED: STAGING_SESSION_COOKIE verilmedi.");
}

console.log("Staging smoke testi başarıyla tamamlandı.");

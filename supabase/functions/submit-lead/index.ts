import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type LeadSubmitPayload = {
  name?: string;
  company?: string;
  email?: string;
  website?: string;
  need?: string;
  note?: string;
  startedAt?: number;
  companyFax?: string;
};

type AttemptOutcome =
  | "blocked_honeypot"
  | "blocked_validation"
  | "blocked_rate_limit"
  | "blocked_duplicate"
  | "accepted";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

const NEED_OPTIONS = new Set(["50 adetten az", "50 200 arasi", "200 adetten fazla"]);
const MIN_SUBMIT_MS = 3000;
const IP_WINDOW_MINUTES = 60;
const EMAIL_WINDOW_HOURS = 24;
const DUPLICATE_WINDOW_DAYS = 7;
const IP_LIMIT = 5;
const EMAIL_LIMIT = 3;
const COOLDOWN_SECONDS = 60;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders
  });
}

function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "";
  }

  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "";
}

function sanitizeText(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeNeedKey(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/\u00e7/g, "c")
    .replace(/\u011f/g, "g")
    .replace(/\u0131/g, "i")
    .replace(/\u00f6/g, "o")
    .replace(/\u015f/g, "s")
    .replace(/\u00fc/g, "u")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeWebsite(value: string) {
  if (!value) return "";

  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

async function sha256(value: string) {
  const encoded = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function logAttempt(
  supabase: ReturnType<typeof createClient>,
  input: {
    ipHash: string;
    emailHash: string;
    fingerprintHash: string;
    websiteHost: string | null;
    userAgent: string;
    outcome: AttemptOutcome;
    reason: string;
  }
) {
  await supabase.from("lead_submission_attempts").insert([
    {
      ip_hash: input.ipHash,
      email_hash: input.emailHash,
      fingerprint_hash: input.fingerprintHash,
      website_host: input.websiteHost,
      user_agent: input.userAgent,
      outcome: input.outcome,
      reason: input.reason
    }
  ]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, message: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, message: "Function secrets are not configured." }, 500);
  }

  const allowedOriginsRaw = Deno.env.get("LEAD_ALLOWED_ORIGINS") || "";
  const allowedOrigins = allowedOriginsRaw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const origin = req.headers.get("origin") || "";
  if (allowedOrigins.length && origin && !allowedOrigins.includes(origin)) {
    return json({ ok: false, message: "Origin is not allowed." }, 403);
  }

  let payload: LeadSubmitPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, message: "Invalid JSON body." }, 400);
  }

  const name = sanitizeText(payload.name);
  const company = sanitizeText(payload.company);
  const email = sanitizeText(payload.email).toLowerCase();
  const websiteRaw = sanitizeText(payload.website);
  const note = sanitizeText(payload.note);
  const need = sanitizeText(payload.need);
  const honeypot = sanitizeText(payload.companyFax);
  const startedAt = Number(payload.startedAt || 0);
  const userAgent = req.headers.get("user-agent") || "";
  const ip = getClientIp(req);
  const website = normalizeWebsite(websiteRaw);
  const websiteHost = website ? new URL(website).hostname.replace(/^www\./, "") : null;
  const normalizedNeed = normalizeNeedKey(need);

  const ipHash = await sha256(ip || "unknown-ip");
  const emailHash = await sha256(email || "unknown-email");
  const fingerprintHash = await sha256(
    [name.toLowerCase(), company.toLowerCase(), email, website || "", need, note.toLowerCase()].join("|")
  );

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  if (honeypot) {
    await logAttempt(supabase, {
      ipHash,
      emailHash,
      fingerprintHash,
      websiteHost,
      userAgent,
      outcome: "blocked_honeypot",
      reason: "Honeypot dolu geldi."
    });
    return json({ ok: false, message: "Basvuru dogrulanamadi." }, 400);
  }

  if (
    name.length < 2 ||
    company.length < 2 ||
    !validateEmail(email) ||
    (websiteRaw && !website) ||
    !NEED_OPTIONS.has(normalizedNeed) ||
    note.length > 2000 ||
    !Number.isFinite(startedAt) ||
    startedAt <= 0 ||
    Date.now() - startedAt < MIN_SUBMIT_MS
  ) {
    await logAttempt(supabase, {
      ipHash,
      emailHash,
      fingerprintHash,
      websiteHost,
      userAgent,
      outcome: "blocked_validation",
      reason: "Sunucu tarafli alan dogrulamasi basarisiz."
    });
    return json({ ok: false, message: "Basvuru verileri gecersiz." }, 400);
  }

  const now = new Date();
  const ipWindowStart = new Date(now.getTime() - IP_WINDOW_MINUTES * 60 * 1000).toISOString();
  const emailWindowStart = new Date(now.getTime() - EMAIL_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const duplicateWindowStart = new Date(
    now.getTime() - DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const cooldownStart = new Date(now.getTime() - COOLDOWN_SECONDS * 1000).toISOString();

  const [
    { count: ipCount, error: ipCountError },
    { count: emailCount, error: emailCountError },
    { count: duplicateCount, error: duplicateCountError },
    { count: cooldownCount, error: cooldownCountError }
  ] = await Promise.all([
    supabase
      .from("lead_submission_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", ipWindowStart),
    supabase
      .from("lead_submission_attempts")
      .select("id", { count: "exact", head: true })
      .eq("email_hash", emailHash)
      .eq("outcome", "accepted")
      .gte("created_at", emailWindowStart),
    supabase
      .from("lead_submission_attempts")
      .select("id", { count: "exact", head: true })
      .eq("fingerprint_hash", fingerprintHash)
      .eq("outcome", "accepted")
      .gte("created_at", duplicateWindowStart),
    supabase
      .from("lead_submission_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", cooldownStart)
  ]);

  if (ipCountError || emailCountError || duplicateCountError || cooldownCountError) {
    return json({ ok: false, message: "Guvenlik kontrolleri tamamlanamadi." }, 500);
  }

  if ((cooldownCount || 0) > 0) {
    await logAttempt(supabase, {
      ipHash,
      emailHash,
      fingerprintHash,
      websiteHost,
      userAgent,
      outcome: "blocked_rate_limit",
      reason: "IP cooldown limitine takildi."
    });
    return json({ ok: false, message: "Cok hizli tekrar deneme algilandi. Bir dakika sonra tekrar deneyin." }, 429);
  }

  if ((ipCount || 0) >= IP_LIMIT) {
    await logAttempt(supabase, {
      ipHash,
      emailHash,
      fingerprintHash,
      websiteHost,
      userAgent,
      outcome: "blocked_rate_limit",
      reason: "Saatlik IP limiti asildi."
    });
    return json({ ok: false, message: "Bu IP icin saatlik basvuru limiti doldu." }, 429);
  }

  if ((emailCount || 0) >= EMAIL_LIMIT) {
    await logAttempt(supabase, {
      ipHash,
      emailHash,
      fingerprintHash,
      websiteHost,
      userAgent,
      outcome: "blocked_rate_limit",
      reason: "Gunluk e-posta limiti asildi."
    });
    return json({ ok: false, message: "Bu e-posta icin gunluk basvuru limiti doldu." }, 429);
  }

  if ((duplicateCount || 0) > 0) {
    await logAttempt(supabase, {
      ipHash,
      emailHash,
      fingerprintHash,
      websiteHost,
      userAgent,
      outcome: "blocked_duplicate",
      reason: "Ayni icerikte tekrar basvuru algilandi."
    });
    return json({ ok: false, message: "Bu basvuru zaten alinmis gorunuyor." }, 409);
  }

  const { error: insertError } = await supabase.from("leads").insert([
    {
      name,
      company,
      email,
      website,
      need,
      note,
      status: "new"
    }
  ]);

  if (insertError) {
    return json({ ok: false, message: "Basvuru kaydedilemedi." }, 500);
  }

  await logAttempt(supabase, {
    ipHash,
    emailHash,
    fingerprintHash,
    websiteHost,
    userAgent,
    outcome: "accepted",
    reason: "Lead kabul edildi."
  });

  return json({ ok: true, message: "Basvuru alindi." });
});

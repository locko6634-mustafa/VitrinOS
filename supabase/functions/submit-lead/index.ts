import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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

const baseCorsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function getCorsHeaders(origin: string, allowedOrigins: string[]) {
  const headers: Record<string, string> = { ...baseCorsHeaders };
  if (allowedOrigins.length > 0 && origin && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

const NEED_OPTIONS = new Set(["50 adetten az", "50 200 arasi", "200 adetten fazla"]);
function requiredPositiveEnv(name: string) {
  const value = Number(Deno.env.get(name));
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Missing or invalid environment variable: ${name}`);
  }
  return value;
}

function getLeadConfig() {
  return {
    minSubmitMs: requiredPositiveEnv("LEAD_MIN_SUBMIT_MS"),
    ipWindowMinutes: requiredPositiveEnv("LEAD_IP_WINDOW_MINUTES"),
    emailWindowHours: requiredPositiveEnv("LEAD_EMAIL_WINDOW_HOURS"),
    duplicateWindowDays: requiredPositiveEnv("LEAD_DUPLICATE_WINDOW_DAYS"),
    ipLimit: requiredPositiveEnv("LEAD_IP_LIMIT"),
    emailLimit: requiredPositiveEnv("LEAD_EMAIL_LIMIT"),
    cooldownSeconds: requiredPositiveEnv("LEAD_COOLDOWN_SECONDS"),
    maxNoteLength: requiredPositiveEnv("LEAD_MAX_NOTE_LENGTH")
  };
}

function json(body: unknown, status = 200, headers: Record<string, string> = baseCorsHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers
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

async function hmacSha256(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function logAttempt(
  supabase: SupabaseClient<any, "public", any>,
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
  const { error } = await supabase.from("lead_submission_attempts").insert([
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

  if (error) {
    throw new Error(`Lead attempt log insert failed: ${error.message}`);
  }
}

Deno.serve(async (req) => {
  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
  let responseHeaders: Record<string, string> = baseCorsHeaders;
  try {
    const allowedOriginsRaw = Deno.env.get("LEAD_ALLOWED_ORIGINS") || "";
    const configuredOrigins = allowedOriginsRaw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
    const allowedOrigins = Array.from(new Set(configuredOrigins));
  const origin = req.headers.get("origin") || "";
  const isOriginAllowed = allowedOrigins.length > 0 && origin && allowedOrigins.includes(origin);
  responseHeaders = getCorsHeaders(origin, allowedOrigins);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: responseHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, message: "Method not allowed.", correlationId }, 405, {
      ...responseHeaders,
      "x-correlation-id": correlationId
    });
  }

  if (!isOriginAllowed) {
    return new Response(JSON.stringify({ ok: false, message: "Origin is not allowed." }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  const leadConfig = getLeadConfig();

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const leadHashSecret = Deno.env.get("LEAD_HASH_SECRET");
  if (!supabaseUrl || !serviceRoleKey || !leadHashSecret) {
    return json({ ok: false, message: "Function secrets are not configured." }, 500, responseHeaders);
  }

  let payload: LeadSubmitPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, message: "Invalid JSON body." }, 400, responseHeaders);
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

  const ipHash = await hmacSha256(`ip:${ip || "unknown-ip"}`, leadHashSecret);
  const emailHash = await hmacSha256(`email:${email || "unknown-email"}`, leadHashSecret);
  const fingerprintHash = await hmacSha256(
    `fingerprint:${[name.toLowerCase(), company.toLowerCase(), email, website || "", need, note.toLowerCase()].join("|")}`,
    leadHashSecret
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
    return json({ ok: false, message: "Basvuru dogrulanamadi." }, 400, responseHeaders);
  }

  if (
    name.length < 2 ||
    company.length < 2 ||
    !validateEmail(email) ||
    (websiteRaw && !website) ||
    !NEED_OPTIONS.has(normalizedNeed) ||
    note.length > leadConfig.maxNoteLength ||
    !Number.isFinite(startedAt) ||
    startedAt <= 0 ||
    Date.now() - startedAt < leadConfig.minSubmitMs
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
    return json({ ok: false, message: "Basvuru verileri gecersiz." }, 400, responseHeaders);
  }

  const { data, error } = await supabase.rpc("submit_lead_atomically", {
    p_ip_hash: ipHash,
    p_email_hash: emailHash,
    p_fingerprint_hash: fingerprintHash,
    p_website_host: websiteHost,
    p_user_agent: userAgent,
    p_name: name,
    p_company: company,
    p_email: email,
    p_website: website,
    p_need: need,
    p_note: note,
    p_ip_limit: leadConfig.ipLimit,
    p_email_limit: leadConfig.emailLimit,
    p_ip_window: `${leadConfig.ipWindowMinutes} minutes`,
    p_email_window: `${leadConfig.emailWindowHours} hours`,
    p_duplicate_window: `${leadConfig.duplicateWindowDays} days`,
    p_cooldown: `${leadConfig.cooldownSeconds} seconds`
  });

  if (error || !data) {
    throw new Error(`Atomic lead submission failed: ${error?.message || "empty response"}`);
  }

  return json(data, Number(data.status || 200), responseHeaders);
  } catch (error) {
    console.error("Lead submission failed", error);
    return json({ ok: false, message: "Basvuru islemi tamamlanamadi." }, 500, responseHeaders);
  }
});

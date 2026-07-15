import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const MAX_BYTES = 10 * 1024 * 1024;
const BUCKET = "source-assets";
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const corsHeaders = {
  ...(allowedOrigins[0] ? { "Access-Control-Allow-Origin": allowedOrigins[0] } : {}),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-correlation-id, traceparent",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function isAllowedOrigin(req: Request) {
  const origin = req.headers.get("Origin");
  return !origin || allowedOrigins.includes(origin);
}

function matchesMagicBytes(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index]);
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12 &&
      new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

async function requireUser(req: Request) {
  const authorization = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

  if (!authorization) return { error: json({ ok: false, message: "Oturum zorunlu." }, 401) };
  if (!supabaseUrl || !publishableKey) return { error: json({ ok: false, message: "Function secrets are not configured." }, 500) };

  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { error: json({ ok: false, message: "Oturum zorunlu." }, 401) };
  return { client, user: data.user };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, message: "Method not allowed." }, 405);
  if (!isAllowedOrigin(req)) return json({ ok: false, message: "Origin not allowed." }, 403);

  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return json({ ok: false, message: "Geçersiz multipart form verisi." }, 400);
  }

  const file = formData.get("file");
  const brandId = String(formData.get("brandId") || "").trim();
  if (!(file instanceof File)) return json({ ok: false, message: "Görsel dosyası zorunlu." }, 400);
  if (!brandId || !/^[0-9a-f-]{36}$/i.test(brandId)) return json({ ok: false, message: "Geçersiz marka." }, 400);

  const mimeType = file.type.toLowerCase();
  if (!MIME_EXTENSIONS[mimeType]) return json({ ok: false, message: "Yalnızca PNG, JPEG veya WebP yüklenebilir." }, 415);
  if (file.size <= 0 || file.size > MAX_BYTES) return json({ ok: false, message: "Görsel 10 MB'dan büyük olamaz." }, 413);

  const { data: brand, error: brandError } = await auth.client
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (brandError || !brand) return json({ ok: false, message: "Marka bulunamadı veya erişilemiyor." }, 404);

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesMagicBytes(bytes, mimeType)) return json({ ok: false, message: "Dosya içeriği MIME türüyle eşleşmiyor." }, 415);

  const path = `${auth.user.id}/${crypto.randomUUID()}.${MIME_EXTENSIONS[mimeType]}`;
  const { error: uploadError } = await auth.client.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: mimeType,
      cacheControl: "3600",
      upsert: false
    });

  if (uploadError) return json({ ok: false, message: "Görsel Storage'a yüklenemedi." }, 502);
  return json({ ok: true, bucket: BUCKET, path });
});

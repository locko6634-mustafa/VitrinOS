import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type TriggerPayload = {
  jobId?: string;
  isRevision?: boolean;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, message: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey =
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const n8nWebhookUrl = Deno.env.get("N8N_WEBHOOK_URL");
  const n8nWebhookSecret = Deno.env.get("N8N_WEBHOOK_SECRET");
  const authorization = req.headers.get("Authorization");

  if (!supabaseUrl || !supabaseAnonKey || !n8nWebhookUrl) {
    return json({ ok: false, message: "Function secrets are not configured." }, 500);
  }

  if (!authorization) {
    return json({ ok: false, message: "Missing authorization header." }, 401);
  }

  let payload: TriggerPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, message: "Invalid JSON body." }, 400);
  }

  if (!payload.jobId) {
    return json({ ok: false, message: "jobId is required." }, 400);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authorization }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const { data: job, error } = await supabase
    .from("jobs")
    .select("id,user_id,brand_id,brief_text,format,revision_note,status")
    .eq("id", payload.jobId)
    .single();

  if (error || !job) {
    return json({ ok: false, message: "Job not found or not accessible." }, 404);
  }

  const expectedStatus = payload.isRevision ? "revision_requested" : "pending";
  if (job.status !== expectedStatus) {
    return json(
      { ok: false, message: `Job status must be ${expectedStatus} before triggering.` },
      409
    );
  }

  const hmacSecret = Deno.env.get("N8N_API_SALT") || Deno.env.get("HMAC_SECRET");
  const timestamp = Date.now().toString();
  const payloadBody = {
    jobId: job.id,
    userId: job.user_id,
    brandId: job.brand_id,
    briefText: job.brief_text,
    format: job.format,
    revisionNote: payload.isRevision ? job.revision_note : null,
    isRevision: Boolean(payload.isRevision)
  };
  const payloadString = JSON.stringify(payloadBody);

  let signature = "";
  if (hmacSecret) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(hmacSecret);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const dataToSign = encoder.encode(`${timestamp}.${payloadString}`);
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, dataToSign);
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (n8nWebhookSecret) {
    headers["x-vitrinos-webhook-secret"] = n8nWebhookSecret;
  }
  if (signature) {
    headers["x-vitrinos-signature"] = signature;
    headers["x-vitrinos-timestamp"] = timestamp;
  }

  const response = await fetch(n8nWebhookUrl, {
    method: "POST",
    headers,
    body: payloadString
  });

  if (!response.ok) {
    const message = await response.text();
    return json(
      { ok: false, message: message || "n8n workflow could not be triggered." },
      502
    );
  }

  return json({ ok: true });
});

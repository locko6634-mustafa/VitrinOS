import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type TriggerPayload = {
  jobId?: string;
  isRevision?: boolean;
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

function json(body: unknown, status = 200, correlationId = "") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(correlationId ? { "x-correlation-id": correlationId } : {})
    }
  });
}

function isAllowedOrigin(req: Request) {
  const origin = req.headers.get("Origin");
  return !origin || allowedOrigins.includes(origin);
}

async function handleDispatchFailure(
  supabaseUrl: string,
  jobId: string,
  errorMessage: string,
  currentRetryCount: number,
  maxRetries: number
) {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is missing, cannot update job status.");
    return;
  }

  const supabaseService = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const nextRetryCount = currentRetryCount + 1;
  const isTransient = true; // n8n webhook veya fetch hataları varsayılan olarak geçicidir.

  if (isTransient && nextRetryCount <= maxRetries) {
    // exponential backoff: 2^nextRetryCount dakika sonra
    const nextRetryAt = new Date(Date.now() + Math.pow(2, nextRetryCount) * 60 * 1000).toISOString();
    const { error } = await supabaseService
      .from("jobs")
      .update({
        status: "pending_retry",
        retry_count: nextRetryCount,
        last_error: errorMessage.substring(0, 1000),
        next_retry_at: nextRetryAt
      })
      .eq("id", jobId);
    
    if (error) {
      console.error(`Failed to update job ${jobId} to pending_retry:`, error);
    }
  } else {
    const { error } = await supabaseService
      .from("jobs")
      .update({
        status: "failed_dispatch",
        last_error: errorMessage.substring(0, 1000)
      })
      .eq("id", jobId);

    if (error) {
      console.error(`Failed to update job ${jobId} to failed_dispatch:`, error);
    }
  }
}

Deno.serve(async (req) => {
  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, message: "Method not allowed." }, 405, correlationId);
  }

  if (!isAllowedOrigin(req)) {
    return json({ ok: false, message: "Origin not allowed." }, 403, correlationId);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey =
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const n8nWebhookUrl = Deno.env.get("N8N_WEBHOOK_URL");
  const n8nWebhookSecret = Deno.env.get("N8N_WEBHOOK_SECRET");
  const hmacSecret = Deno.env.get("N8N_API_SALT") || Deno.env.get("HMAC_SECRET");
  const authorization = req.headers.get("Authorization");

  if (!supabaseUrl || !supabaseAnonKey || !n8nWebhookUrl || !hmacSecret) {
    return json({ ok: false, message: "Function secrets are not configured." }, 500, correlationId);
  }

  if (!authorization) {
    return json({ ok: false, message: "Missing authorization header." }, 401, correlationId);
  }

  let payload: TriggerPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, message: "Invalid JSON body." }, 400, correlationId);
  }

  if (!payload.jobId) {
    return json({ ok: false, message: "jobId is required." }, 400, correlationId);
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
    .select("id,user_id,brand_id,brief_text,format,revision_note,status,source_image_path,retry_count,max_retries")
    .eq("id", payload.jobId)
    .single();

  if (error || !job) {
    return json({ ok: false, message: "Job not found or not accessible." }, 404, correlationId);
  }

  const expectedStatus = payload.isRevision ? "revision_requested" : "pending";
  // Eger bu bir yeniden deneme ise status pending_retry de olabilir
  if (job.status !== expectedStatus && job.status !== "pending_retry") {
    return json(
      { ok: false, message: `Job status must be ${expectedStatus} or pending_retry before triggering.`, correlationId },
      409
    );
  }

  const timestamp = Date.now().toString();
  const payloadBody = {
    jobId: job.id,
    userId: job.user_id,
    brandId: job.brand_id,
    briefText: job.brief_text,
    format: job.format,
    revisionNote: payload.isRevision ? job.revision_note : null,
    sourceImagePath: payload.isRevision ? null : job.source_image_path,
    isRevision: Boolean(payload.isRevision)
  };
  const payloadString = JSON.stringify(payloadBody);

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
  const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-vitrinos-signature": signature,
    "x-vitrinos-timestamp": timestamp,
    "x-correlation-id": correlationId,
    traceparent: req.headers.get("traceparent") || ""
  };

  if (n8nWebhookSecret) {
    headers["x-vitrinos-webhook-secret"] = n8nWebhookSecret;
  }

  let response: Response;
  try {
    response = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers,
      body: payloadString
    });
  } catch (fetchErr) {
    const errorMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    await handleDispatchFailure(supabaseUrl, job.id, errorMsg, job.retry_count, job.max_retries);
    return json(
      { ok: false, message: `n8n webhook fetch error: ${errorMsg}`, correlationId },
      502,
      correlationId
    );
  }

  if (!response.ok) {
    const message = await response.text();
    const errorMsg = message || `n8n responded with status ${response.status}`;
    await handleDispatchFailure(supabaseUrl, job.id, errorMsg, job.retry_count, job.max_retries);
    return json(
      { ok: false, message: errorMsg, correlationId },
      502,
      correlationId
    );
  }

  // n8n tetiklemesi basarili oldugunda status pending_retry ise eski durumuna geri alalim
  if (job.status === "pending_retry") {
    const originalStatus = (job.revision_note && job.revision_note.length > 0) ? "revision_requested" : "pending";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (serviceRoleKey) {
      const supabaseService = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      await supabaseService
        .from("jobs")
        .update({ status: originalStatus })
        .eq("id", job.id);
    }
  }

  return json({ ok: true, correlationId }, 200, correlationId);
});

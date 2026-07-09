import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type JobActionPayload = {
  action?: "approve_job" | "request_job_revision";
  jobId?: string;
  revisionNote?: string;
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

function sanitizeText(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function getAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Function secrets are not configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

async function requireUser(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization) {
    return { error: json({ ok: false, message: "Missing authorization header." }, 401) };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey =
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

  if (!supabaseUrl || !publishableKey) {
    return { error: json({ ok: false, message: "Function secrets are not configured." }, 500) };
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: {
      headers: { Authorization: authorization }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    return { error: json({ ok: false, message: "Oturum zorunlu." }, 401) };
  }

  return { user: data.user };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, message: "Method not allowed." }, 405);
  }

  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  let payload: JobActionPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, message: "Invalid JSON body." }, 400);
  }

  const jobId = sanitizeText(payload.jobId);
  if (!jobId) {
    return json({ ok: false, message: "Job id zorunlu." }, 400);
  }

  const supabase = getAdminClient();

  if (payload.action === "approve_job") {
    const { data: job, error } = await supabase
      .from("jobs")
      .update({ status: "approved" })
      .eq("id", jobId)
      .eq("user_id", auth.user.id)
      .eq("status", "completed")
      .select("id,user_id,brand_id,brief_text,format,status,image_url,revision_count,revision_note")
      .single();

    if (error || !job) {
      return json({ ok: false, message: "Job bulunamadi veya onaylanabilir durumda degil." }, 409);
    }

    return json({ ok: true, job });
  }

  if (payload.action === "request_job_revision") {
    const revisionNote = sanitizeText(payload.revisionNote);
    if (revisionNote.length < 6) {
      return json({ ok: false, message: "Revizyon notu en az 6 karakter olmali." }, 400);
    }

    const { data: job, error } = await supabase.rpc("apply_job_revision_request", {
      target_job_id: jobId,
      target_user_id: auth.user.id,
      revision_note: revisionNote
    });

    if (error || !job) {
      return json(
        { ok: false, message: error?.message || "Job bulunamadi, revizyon istenebilir durumda degil veya revizyon limitine ulasildi." },
        409
      );
    }

    return json({ ok: true, job });
  }

  return json({ ok: false, message: "Bilinmeyen islem." }, 400);
});

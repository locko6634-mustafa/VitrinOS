import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const workerSecret = Deno.env.get("STORAGE_CLEANUP_WORKER_SECRET");

if (!supabaseUrl || !serviceRoleKey) throw new Error("Function secrets are not configured.");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function isAuthorized(req: Request) {
  const secret = req.headers.get("x-storage-cleanup-secret");
  const authorization = req.headers.get("authorization");
  return Boolean((workerSecret && secret === workerSecret) || authorization === `Bearer ${serviceRoleKey}`);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, message: "Method not allowed." }, 405);
  if (!isAuthorized(req)) return json({ ok: false, message: "Unauthorized." }, 401);

  const { error: reconcileError } = await supabase.rpc("enqueue_orphan_storage_cleanup");
  if (reconcileError) return json({ ok: false, message: reconcileError.message }, 500);

  const { data: jobs, error: claimError } = await supabase.rpc("claim_storage_cleanup_jobs", { batch_size: 50 });
  if (claimError) return json({ ok: false, message: claimError.message }, 500);

  const result = { processed: 0, succeeded: 0, retried: 0, dead: 0 };
  for (const job of jobs || []) {
    result.processed += 1;
    const { error: removeError } = await supabase.storage.from(job.bucket_id).remove([job.object_path]);
    const { error: completeError } = await supabase.rpc("complete_storage_cleanup_job", {
      job_id: job.id,
      succeeded: !removeError,
      error_message: removeError?.message || null
    });

    if (completeError) console.error("Queue completion failed", job.id, completeError);
    if (!removeError) result.succeeded += 1;
    else if (job.attempts >= 8) result.dead += 1;
    else result.retried += 1;
  }

  return json({ ok: true, ...result });
});

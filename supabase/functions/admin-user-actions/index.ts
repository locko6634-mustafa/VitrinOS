import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type AdminUserActionPayload = {
  action?: "invite_user" | "invite_lead" | "toggle_user_status" | "delete_user" | "send_password_recovery";
  email?: string;
  name?: string;
  leadId?: string;
  userId?: string;
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
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function sanitizeText(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isAllowedOrigin(req: Request) {
  const origin = req.headers.get("Origin");
  if (!origin) return true;
  return allowedOrigins.includes(origin);
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

async function logSecurityEvent(
  supabase: SupabaseClient<any, "public", any>,
  input: {
    actor: { id: string; email?: string | null };
    action: string;
    outcome: "requested" | "succeeded" | "failed";
    targetUserId?: string | null;
    targetEmail?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const { error } = await supabase.from("security_audit_log").insert({
    actor_user_id: input.actor.id,
    actor_email: input.actor.email || null,
    action: input.action,
    outcome: input.outcome,
    target_user_id: input.targetUserId || null,
    target_email: input.targetEmail || null,
    metadata: input.metadata || {}
  });

  if (error) {
    throw new Error(`Denetim kaydi yazilamadi: ${error.message}`);
  }
}

async function requireAdmin(req: Request) {
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
  const role = data.user?.app_metadata?.role;

  if (error || !data.user || role !== "admin") {
    return { error: json({ ok: false, message: "Yetkisiz islem." }, 403) };
  }

  return { user: data.user };
}

async function inviteUser(
  supabase: SupabaseClient<any, "public", any>,
  input: { email: string; name: string; redirectTo: string; actor: { id: string; email?: string | null }; source: string }
) {
  const email = sanitizeText(input.email).toLowerCase();
  const name = sanitizeText(input.name);

  if (!validateEmail(email)) {
    return json({ ok: false, message: "Gecerli bir e-posta adresi girin." }, 400);
  }

  if (name.length < 2) {
    return json({ ok: false, message: "Kullanici adi zorunlu." }, 400);
  }

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { name },
    redirectTo: input.redirectTo
  });

  if (error) {
    return json({ ok: false, message: error.message }, error.status || 400);
  }

  try {
    await logSecurityEvent(supabase, {
      actor: input.actor,
      action: "user_invited",
      outcome: "succeeded",
      targetUserId: data.user?.id || null,
      targetEmail: email,
      metadata: { source: input.source }
    });
  } catch {
    return json({ ok: false, message: "Davet gonderildi ancak denetim kaydi yazilamadi. Islemi tekrar etmeyin." }, 500);
  }

  return json({ ok: true, userId: data.user?.id || null });
}

function getInviteRedirectUrl() {
  const configuredAppUrl = Deno.env.get("PUBLIC_APP_URL");
  const baseUrl = configuredAppUrl;

  if (!baseUrl) {
    throw new Error("PUBLIC_APP_URL secret is required.");
  }

  return new URL("set-password.html", `${baseUrl.replace(/\/$/, "")}/`).toString();
}

async function enqueueUserGeneratedAssetCleanup(
  supabase: SupabaseClient<any, "public", any>,
  userId: string
) {
  const { error } = await supabase.rpc("enqueue_user_storage_cleanup", {
    target_user_id: userId
  });
  if (error) throw new Error(`Kullanici asset temizleme kuyrugu olusturulamadi: ${error.message}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, message: "Method not allowed." }, 405);
  }

  if (!isAllowedOrigin(req)) {
    return json({ ok: false, message: "Origin not allowed." }, 403);
  }

  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  let payload: AdminUserActionPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, message: "Invalid JSON body." }, 400);
  }

  const supabase = getAdminClient();

  if (payload.action === "invite_user") {
    return inviteUser(supabase, {
      email: payload.email || "",
      name: payload.name || "",
      redirectTo: getInviteRedirectUrl(),
      actor: auth.user,
      source: "admin_panel"
    });
  }

  if (payload.action === "invite_lead") {
    const leadId = sanitizeText(payload.leadId);
    if (!leadId) {
      return json({ ok: false, message: "Lead id zorunlu." }, 400);
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id,name,email")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return json({ ok: false, message: "Basvuru bulunamadi." }, 404);
    }

    const inviteResponse = await inviteUser(supabase, {
      email: lead.email,
      name: lead.name,
      redirectTo: getInviteRedirectUrl(),
      actor: auth.user,
      source: "lead_approval"
    });

    if (!inviteResponse.ok) {
      return inviteResponse;
    }

    const { error: updateError } = await supabase
      .from("leads")
      .update({ status: "approved" })
      .eq("id", lead.id);

    if (updateError) {
      return json({ ok: false, message: updateError.message }, 400);
    }

    return json({ ok: true });
  }

  if (payload.action === "toggle_user_status") {
    const userId = sanitizeText(payload.userId);
    if (!userId) {
      return json({ ok: false, message: "Kullanici id zorunlu." }, 400);
    }

    if (userId === auth.user.id) {
      return json({ ok: false, message: "Kendi admin hesabinizin durumunu degistiremezsiniz." }, 400);
    }

    const { data: current, error: getError } = await supabase.auth.admin.getUserById(userId);
    if (getError || !current.user) {
      return json({ ok: false, message: "Kullanici bulunamadi." }, 404);
    }

    const currentUser = current.user as typeof current.user & { banned_until?: string | null };
    if (current.user.app_metadata?.role === "admin") {
      return json({ ok: false, message: "Admin hesaplarinin durumu bu panelden degistirilemez." }, 400);
    }
    const isBanned = Boolean(currentUser.banned_until);
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      isBanned ? { ban_duration: "none" } : { ban_duration: "876000h" }
    );

    if (updateError) {
      return json({ ok: false, message: updateError.message }, updateError.status || 400);
    }

    if (!isBanned) {
      const { error: revokeError } = await supabase.rpc("revoke_user_sessions", {
        target_user_id: userId
      });
      if (revokeError) {
        return json({ ok: false, message: "Kullanici pasiflestirildi ancak aktif oturumlar sonlandirilamadi." }, 500);
      }
    }

    try {
      await logSecurityEvent(supabase, {
        actor: auth.user,
        action: isBanned ? "user_activated" : "user_deactivated",
        outcome: "succeeded",
        targetUserId: userId,
        targetEmail: current.user.email || null,
        metadata: { sessions_revoked: !isBanned }
      });
    } catch {
      return json({ ok: false, message: "Kullanici durumu degisti ancak denetim kaydi yazilamadi. Islemi tekrar etmeyin." }, 500);
    }

    return json({ ok: true, status: isBanned ? "active" : "inactive" });
  }

  if (payload.action === "send_password_recovery") {
    const userId = sanitizeText(payload.userId);
    if (!userId) {
      return json({ ok: false, message: "Kullanici id zorunlu." }, 400);
    }

    const { data: target, error: targetError } = await supabase.auth.admin.getUserById(userId);
    if (targetError || !target.user?.email) {
      return json({ ok: false, message: "Kullanici bulunamadi." }, 404);
    }

    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(target.user.email, {
      redirectTo: getInviteRedirectUrl()
    });
    if (recoveryError) {
      return json({ ok: false, message: recoveryError.message }, recoveryError.status || 400);
    }

    try {
      await logSecurityEvent(supabase, {
        actor: auth.user,
        action: "password_recovery_requested",
        outcome: "succeeded",
        targetUserId: userId,
        targetEmail: target.user.email
      });
    } catch {
      return json({ ok: false, message: "Sifirlama e-postasi gonderildi ancak denetim kaydi yazilamadi. Islemi tekrar etmeyin." }, 500);
    }

    return json({ ok: true });
  }

  if (payload.action === "delete_user") {
    const userId = sanitizeText(payload.userId);
    if (!userId) {
      return json({ ok: false, message: "Kullanici id zorunlu." }, 400);
    }

    if (userId === auth.user.id) {
      return json({ ok: false, message: "Kendi admin hesabiniz silinemez." }, 400);
    }

    const { data: target, error: targetError } = await supabase.auth.admin.getUserById(userId);
    if (targetError || !target.user) {
      return json({ ok: false, message: "Kullanici bulunamadi." }, 404);
    }

    if (target.user.app_metadata?.role === "admin") {
      return json({ ok: false, message: "Baska bir admin hesabi bu panelden silinemez." }, 400);
    }

    try {
      await logSecurityEvent(supabase, {
        actor: auth.user,
        action: "user_deletion",
        outcome: "requested",
        targetUserId: userId,
        targetEmail: target.user.email || null
      });
    } catch {
      return json({ ok: false, message: "Kullanici silinmeden once denetim kaydi yazilamadi." }, 500);
    }

    const { error: revokeError } = await supabase.rpc("revoke_user_sessions", {
      target_user_id: userId
    });
    if (revokeError) {
      return json({ ok: false, message: "Kullanici silinmedi; aktif oturumlar sonlandirilamadi." }, 500);
    }

    try {
      await enqueueUserGeneratedAssetCleanup(supabase, userId);
    } catch (assetError) {
      console.error("Kullanici asset temizleme hatasi:", assetError);
      return json({
        ok: false,
        message: "Kullanici silinmedi; uretilen dosyalar temizlenemedi."
      }, 500);
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      return json({ ok: false, message: deleteError.message }, deleteError.status || 400);
    }

    try {
      await logSecurityEvent(supabase, {
        actor: auth.user,
        action: "user_deletion",
        outcome: "succeeded",
        targetUserId: userId,
        targetEmail: target.user.email || null
      });
    } catch {
      return json({ ok: false, message: "Kullanici silindi ancak denetim kaydi yazilamadi. Islemi tekrar etmeyin." }, 500);
    }

    return json({ ok: true, userId });
  }

  return json({ ok: false, message: "Bilinmeyen islem." }, 400);
});

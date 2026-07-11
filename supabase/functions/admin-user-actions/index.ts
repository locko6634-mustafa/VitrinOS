import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type AdminUserActionPayload = {
  action?: "invite_user" | "invite_lead" | "toggle_user_status" | "delete_user";
  email?: string;
  name?: string;
  leadId?: string;
  userId?: string;
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

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
  input: { email: string; name: string }
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
    redirectTo: "https://locko6634-mustafa.github.io/VitrinOS/set-password.html"
  });

  if (error) {
    return json({ ok: false, message: error.message }, error.status || 400);
  }

  return json({ ok: true, userId: data.user?.id || null });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, message: "Method not allowed." }, 405);
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
      name: payload.name || ""
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
      name: lead.name
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

    return json({ ok: true, status: isBanned ? "active" : "inactive" });
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

    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      return json({ ok: false, message: deleteError.message }, deleteError.status || 400);
    }

    return json({ ok: true, userId });
  }

  return json({ ok: false, message: "Bilinmeyen islem." }, 400);
});

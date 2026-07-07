(function () {
  window.VitrinOS = window.VitrinOS || {};

  function getClient() {
    const config = window.VitrinOS.config || {};

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("Supabase SDK yüklenemedi.");
    }

    if (!window.VitrinOS.supabaseClient) {
      window.VitrinOS.supabaseClient = window.supabase.createClient(
        config.supabaseUrl,
        config.supabasePublishableKey,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        }
      );
    }

    return window.VitrinOS.supabaseClient;
  }

  function normalizeLoginIdentifier(identifier) {
    const config = window.VitrinOS.config || {};
    const usernameDomain = config.authUsernameDomain || "vitrinos.local";
    const value = String(identifier || "").trim().toLocaleLowerCase("tr-TR");
    if (!value) return "";
    return value.includes("@") ? value : `${value}@${usernameDomain}`;
  }

  function getRole(user) {
    return user?.app_metadata?.role || null;
  }

  async function signInWithPassword(identifier, password) {
    const client = getClient();
    return client.auth.signInWithPassword({
      email: normalizeLoginIdentifier(identifier),
      password
    });
  }

  async function getCurrentUser() {
    const client = getClient();
    const {
      data: { session }
    } = await client.auth.getSession();

    if (!session) return null;

    const {
      data: { user },
      error
    } = await client.auth.getUser();

    if (error || !user) return null;
    return { session, user, role: getRole(user) };
  }

  async function requireAuthenticated(options = {}) {
    const redirectTo = options.redirectTo || "login.html";
    const context = await getCurrentUser();

    if (!context) {
      window.location.replace(redirectTo);
      return null;
    }

    return context;
  }

  async function requireAdmin(options = {}) {
    const redirectTo = options.redirectTo || "login.html";
    const fallbackTo = options.fallbackTo || "dashboard.html";
    const context = await getCurrentUser();

    if (!context) {
      window.location.replace(redirectTo);
      return null;
    }

    if (context.role !== "admin") {
      window.location.replace(fallbackTo);
      return null;
    }

    return context;
  }

  async function signOut(redirectTo = "login.html") {
    await getClient().auth.signOut();
    window.location.href = redirectTo;
  }

  window.VitrinOS.auth = {
    getClient,
    getCurrentUser,
    getRole,
    normalizeLoginIdentifier,
    requireAdmin,
    requireAuthenticated,
    signInWithPassword,
    signOut
  };
})();

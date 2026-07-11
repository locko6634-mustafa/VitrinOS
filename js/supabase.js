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

    try {
      const context = await getCurrentUser();
      if (context) return context;
    } catch (error) {
      console.error("Oturum doğrulanamadı:", error);
    }

    window.location.replace(redirectTo);
    return null;
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

  const generatedAssetBucket = "generated-assets";
  const signedAssetUrlCache = new Map();

  function getGeneratedAssetPath(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const publicMarker = `/storage/v1/object/public/${generatedAssetBucket}/`;
    const publicIndex = raw.indexOf(publicMarker);
    if (publicIndex >= 0) {
      return decodeURIComponent(raw.slice(publicIndex + publicMarker.length).split("?")[0]);
    }

    const objectMarker = `/storage/v1/object/sign/${generatedAssetBucket}/`;
    const objectIndex = raw.indexOf(objectMarker);
    if (objectIndex >= 0) {
      return decodeURIComponent(raw.slice(objectIndex + objectMarker.length).split("?")[0]);
    }

    if (/^https?:\/\//i.test(raw)) return "";
    return raw.replace(/^\/+/, "").replace(new RegExp(`^${generatedAssetBucket}/`), "");
  }

  async function getGeneratedAssetUrl(value, expiresIn = 300) {
    const path = getGeneratedAssetPath(value);
    if (!path) return "";

    const cached = signedAssetUrlCache.get(path);
    if (cached && cached.expiresAt > Date.now()) return cached.url;

    const { data, error } = await getClient()
      .storage
      .from(generatedAssetBucket)
      .createSignedUrl(path, expiresIn);

    if (error) throw error;

    const url = data?.signedUrl || "";
    if (url) {
      signedAssetUrlCache.set(path, {
        url,
        expiresAt: Date.now() + Math.max(expiresIn - 30, 30) * 1000
      });
    }

    return url;
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

  window.VitrinOS.storage = {
    generatedAssetBucket,
    getGeneratedAssetPath,
    getGeneratedAssetUrl
  };
})();

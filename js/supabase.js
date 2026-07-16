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
          global: {
            headers: {
              "x-correlation-id": window.VitrinOS.observability?.getCorrelationId?.() || "",
              traceparent: window.VitrinOS.observability?.getTraceparent?.() || ""
            }
          },
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

  const ADMIN_MFA_TRUST_KEY = "vitrinos_admin_mfa_trust";
  const ADMIN_MFA_TRUST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
  const REMEMBERED_LOGIN_KEY = "vitrinos_remembered_login";

  function rememberAdminMfa(user) {
    try {
      localStorage.setItem(ADMIN_MFA_TRUST_KEY, JSON.stringify({
        userId: user?.id || "",
        verifiedAt: Date.now()
      }));
    } catch (error) {
      console.warn("Admin MFA güveni tarayıcıya kaydedilemedi.", error);
    }
  }

  function hasRecentAdminMfa(user) {
    try {
      const stored = JSON.parse(localStorage.getItem(ADMIN_MFA_TRUST_KEY) || "null");
      return Boolean(
        stored?.userId &&
        stored.userId === user?.id &&
        Number.isFinite(stored.verifiedAt) &&
        Date.now() - stored.verifiedAt < ADMIN_MFA_TRUST_WINDOW_MS
      );
    } catch (error) {
      return false;
    }
  }

  function rememberLogin(user, shouldRemember) {
    try {
      if (shouldRemember) {
        localStorage.setItem(REMEMBERED_LOGIN_KEY, JSON.stringify({ userId: user?.id || "" }));
      } else {
        localStorage.removeItem(REMEMBERED_LOGIN_KEY);
      }
    } catch (error) {
      console.warn("Oturum hatırlama tercihi tarayıcıya kaydedilemedi.", error);
    }
  }

  function hasRememberedLogin(user) {
    try {
      const stored = JSON.parse(localStorage.getItem(REMEMBERED_LOGIN_KEY) || "null");
      return Boolean(stored?.userId && stored.userId === user?.id);
    } catch (error) {
      return false;
    }
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
    const { data: assurance, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) throw assuranceError;

    return {
      session,
      user,
      role: getRole(user),
      currentLevel: assurance.currentLevel,
      nextLevel: assurance.nextLevel
    };
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
    const requireMfa = options.requireMfa !== false;
    const mfaSetupTo = options.mfaSetupTo || "mfa-setup.html";
    const mfaChallengeTo = options.mfaChallengeTo || "mfa-challenge.html";
    const context = await getCurrentUser();

    if (!context) {
      window.location.replace(redirectTo);
      return null;
    }

    if (context.role !== "admin") {
      window.location.replace(fallbackTo);
      return null;
    }

    const mfaSatisfied = context.currentLevel === "aal2" || hasRecentAdminMfa(context.user);
    if (requireMfa && !mfaSatisfied) {
      window.location.replace(context.nextLevel === "aal2" ? mfaChallengeTo : mfaSetupTo);
      return null;
    }

    return context;
  }

  async function signOut(redirectTo = "login.html") {
    await getClient().auth.signOut();
    rememberLogin(null, false);
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
    hasRecentAdminMfa,
    hasRememberedLogin,
    rememberLogin,
    rememberAdminMfa,
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

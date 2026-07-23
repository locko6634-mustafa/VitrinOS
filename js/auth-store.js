(function () {
  window.VitrinOS = window.VitrinOS || {};

  let currentUser = null;
  let isInitialized = false;
  const listeners = new Set();

  function notify() {
    listeners.forEach((fn) => {
      try {
        fn(currentUser);
      } catch (err) {
        console.error("Auth listener error:", err);
      }
    });
  }

  async function fetchSession() {
    try {
      const data = await window.VitrinOS.api.get("/auth/session");
      currentUser = data.user || null;
    } catch (err) {
      currentUser = null;
    } finally {
      isInitialized = true;
      notify();
    }
    return currentUser;
  }

  async function logout() {
    try {
      await window.VitrinOS.api.post("/auth/logout");
    } catch (err) {
      console.warn("Logout error:", err);
    } finally {
      currentUser = null;
      notify();
      const loginUrl = (window.VitrinOS.config?.appBasePath || "/") + "login.html";
      window.location.href = loginUrl;
    }
  }

  function subscribe(fn) {
    listeners.add(fn);
    if (isInitialized) {
      fn(currentUser);
    }
    return () => listeners.delete(fn);
  }

  function getUser() {
    return currentUser;
  }

  function isLoggedIn() {
    return !!currentUser;
  }

  function isAdmin() {
    return currentUser?.role === "admin";
  }

  window.VitrinOS.authStore = {
    fetchSession,
    logout,
    subscribe,
    getUser,
    isLoggedIn,
    isAdmin
  };
})();

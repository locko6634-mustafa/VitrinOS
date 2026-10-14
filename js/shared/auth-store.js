// VitrinOS Kimlik ve Oturum Yönetimi (ESM & Shared)
import { api } from "./api-client.js";
import { config } from "./config.js";

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

export async function fetchSession() {
  try {
    const data = await api.get("/auth/session");
    currentUser = data.user || null;
  } catch (err) {
    currentUser = null;
  } finally {
    isInitialized = true;
    notify();
  }
  return currentUser;
}

export async function logout() {
  try {
    await api.post("/auth/logout");
  } catch (err) {
    console.warn("Logout error:", err);
  } finally {
    currentUser = null;
    notify();
    const loginUrl = (config?.appBasePath || "/") + "login.html";
    if (typeof window !== "undefined") {
      window.location.href = loginUrl;
    }
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  if (isInitialized) {
    fn(currentUser);
  }
  return () => listeners.delete(fn);
}

export function getUser() {
  return currentUser;
}

export function isLoggedIn() {
  return !!currentUser;
}

export function isAdmin() {
  return currentUser?.role === "admin";
}

export const authStore = {
  fetchSession,
  logout,
  subscribe,
  getUser,
  isLoggedIn,
  isAdmin
};

if (typeof window !== "undefined") {
  window.VitrinOS = window.VitrinOS || {};
  window.VitrinOS.authStore = authStore;
}

export default authStore;

(function () {
  window.VitrinOS = window.VitrinOS || {};

  class ApiError extends Error {
    constructor(message, code, status, details, correlationId) {
      super(message);
      this.name = "ApiError";
      this.code = code || "UNKNOWN_ERROR";
      this.status = status || 500;
      this.details = details || null;
      this.correlationId = correlationId || null;
    }
  }

  const getApiBaseUrl = () => {
    const config = window.VitrinOS?.config;
    return (config && config.apiBaseUrl) || "/api/v1";
  };

  const getCsrfToken = () => {
    const name = "csrf_token=";
    const decodedCookie = decodeURIComponent(document.cookie || "");
    const ca = decodedCookie.split(";");
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i].trim();
      if (c.indexOf(name) === 0) {
        return c.substring(name.length, c.length);
      }
    }
    return null;
  };

  async function request(endpoint, options = {}) {
    const baseUrl = getApiBaseUrl();
    const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

    const headers = new Headers(options.headers || {});
    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
    }

    const csrfToken = getCsrfToken();
    if (csrfToken && ["POST", "PUT", "PATCH", "DELETE"].includes((options.method || "GET").toUpperCase())) {
      headers.set("X-CSRF-Token", csrfToken);
    }

    const fetchOptions = {
      ...options,
      headers,
      credentials: options.credentials || "include"
    };

    if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, fetchOptions);
      let payload = null;
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        payload = await response.json();
      } else {
        const text = await response.text();
        payload = text ? { data: text } : null;
      }

      if (!response.ok) {
        const code = payload?.code || payload?.error?.code || `HTTP_${response.status}`;
        const message = payload?.message || payload?.error?.message || "Sunucu hatası oluştu.";
        const correlationId = payload?.correlationId || response.headers.get("x-correlation-id");
        throw new ApiError(message, code, response.status, payload?.details, correlationId);
      }

      return payload?.data !== undefined ? payload.data : payload;
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      throw new ApiError(err.message || "Ağ bağlantı hatası oluştu.", "NETWORK_ERROR", 0);
    }
  }

  async function uploadFile(presignedUrl, file, contentType) {
    const headers = {
      "Content-Type": contentType || file.type || "application/octet-stream"
    };

    const response = await fetch(presignedUrl, {
      method: "PUT",
      headers,
      body: file
    });

    if (!response.ok) {
      throw new ApiError("Dosya depolama sunucusuna yüklenemedi.", "STORAGE_UPLOAD_ERROR", response.status);
    }
    return true;
  }

  window.VitrinOS.api = {
    request,
    get: (endpoint, options) => request(endpoint, { ...options, method: "GET" }),
    post: (endpoint, body, options) => request(endpoint, { ...options, method: "POST", body }),
    put: (endpoint, body, options) => request(endpoint, { ...options, method: "PUT", body }),
    patch: (endpoint, body, options) => request(endpoint, { ...options, method: "PATCH", body }),
    delete: (endpoint, options) => request(endpoint, { ...options, method: "DELETE" }),
    uploadFile,
    ApiError
  };
})();

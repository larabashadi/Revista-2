import axios from "axios";

// NOTE
// - In dev, Vite proxies `/api` to the backend (see vite.config.ts).
// - In builds without a dev proxy, set VITE_API_BASE (e.g. http://localhost:8000)
//   so requests still work.
const baseURL = (import.meta as any)?.env?.VITE_API_BASE || "";

export const api = axios.create({
  baseURL,
  timeout: 30000,
});

// Keep a single source of truth for auth tokens.
// We store the token under `sms_token` (Sports Magazine SaaS token).
// Some older builds used `token`; we keep backward compatibility.
export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem("sms_token", token);
    // Back-compat: keep the legacy key in sync
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("sms_token");
    localStorage.removeItem("token");
  }
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("sms_token") || localStorage.getItem("token");
  if (token) {
    config.headers = (config.headers ?? ({} as any)) as any;
(config.headers as any).Authorization = `Bearer ${token}`;

  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      localStorage.removeItem("sms_token");
      localStorage.removeItem("token");
      localStorage.removeItem("sms_user");
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

// Some pages import the API client as default; keep this for compatibility.
export default api;

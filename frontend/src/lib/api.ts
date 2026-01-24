/*import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { API_BASE } from "../config";
import { useAuth } from "../store/auth";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = (useAuth as any).getState?.()?.token;
  if (token) {
    // Axios v1 usa AxiosHeaders internamente; set() es lo correcto
    if (config.headers && typeof (config.headers as any).set === "function") {
      (config.headers as any).set("Authorization", `Bearer ${token}`);
    } else {
      (config.headers as any) = config.headers ?? {};
      (config.headers as any)["Authorization"] = `Bearer ${token}`;
    }
  }
  return config;
});
const pushNet = (x: any) => {
  const w = window as any;
  w.__netlog__ = w.__netlog__ || [];
  w.__netlog__.push({ t: Date.now(), ...x });
};

api.interceptors.request.use((config) => {
  pushNet({ kind: "REQ", url: `${config.baseURL || ""}${config.url || ""}` });
  return config;
});

api.interceptors.response.use(
  (res) => {
    pushNet({ kind: "RES", url: `${res.config.baseURL || ""}${res.config.url || ""}`, status: res.status });
    return res;
  },
  (err) => {
    pushNet({
      kind: "ERR",
      url: `${err?.config?.baseURL || ""}${err?.config?.url || ""}`,
      status: err?.response?.status,
      msg: err?.message,
    });
    return Promise.reject(err);
  }
);*/
import axios, { AxiosError, AxiosResponse } from "axios";

declare global {
  interface Window {
    __API_BASE__?: string;
  }
}

/**
 * IMPORTANT (Render/Netlify/Vercel):
 * VITE_* variables are baked at build time. In Render Static Sites, be sure
 * to set VITE_API_BASE in the Render environment (or in the build command).
 *
 * Example:
 *   VITE_API_BASE=https://<your-backend>.onrender.com
 */
export const API_BASE: string = (() => {
  const raw =
    (import.meta as any)?.env?.VITE_API_BASE ??
    (typeof window !== "undefined" ? window.__API_BASE__ : "") ??
    "";
  return String(raw || "").trim().replace(/\/+$/, "");
})();

export const api = axios.create({
  baseURL: API_BASE || undefined,
  timeout: 120_000, // default 2 min; override per request for heavy import/export
  withCredentials: false, // we use Bearer token, not cookies
});

let _token: string | null = null;

export function setToken(token: string | null) {
  _token = token;
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
}

// Initialize token from storage (supports legacy keys)
(() => {
  const t =
    localStorage.getItem("token") ||
    localStorage.getItem("sms_token") ||
    null;
  if (t) _token = t;
})();

// Axios v1 types are strict; use `any` for interceptor config to avoid TS friction.
api.interceptors.request.use((config: any) => {
  const token =
    _token ||
    localStorage.getItem("token") ||
    localStorage.getItem("sms_token");

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res: AxiosResponse) => res,
  (err: AxiosError) => {
    // Helpful console error for debugging CORS / DNS / SSL issues:
    if (!err.response) {
      // Network error / CORS / blocked request
      // eslint-disable-next-line no-console
      console.error("[API] Network error", {
        message: err.message,
        baseURL: API_BASE,
        url: (err.config as any)?.url,
        method: (err.config as any)?.method,
      });
    }
    return Promise.reject(err);
  }
);

/**
 * Build a fully-qualified URL to a backend path (e.g. /api/assets/file/xxx).
 * - If `p` is already absolute (http/https), it's returned as-is.
 * - If API_BASE is empty, it returns `p` (relative), which only works if you proxy /api in the same origin.
 */
export function apiUrl(p: string): string {
  const s = String(p || "").trim();
  if (!s) return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (!API_BASE) return s;
  if (s.startsWith("/")) return `${API_BASE}${s}`;
  return `${API_BASE}/${s}`;
}

export default api;

  return config;
});


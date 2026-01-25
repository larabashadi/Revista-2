import axios, { AxiosHeaders, InternalAxiosRequestConfig } from "axios";

/**
 * API base URL. In Render you usually set VITE_API_BASE to the BACKEND url:
 *   https://<your-backend>.onrender.com
 *
 * Some users accidentally set it to .../api . To be resilient, we auto-rewrite
 * requests that start with /api when baseURL already ends with /api.
 */
const RAW_BASE = ((import.meta as any).env?.VITE_API_BASE as string) || "";
const BASE = (RAW_BASE || "").trim().replace(/\/+$/, "");

export const API_BASE = BASE;

/** Build an absolute URL pointing to the backend (useful for thumbnails/assets). */
export function apiUrl(path: string): string {
  if (!path) return BASE;
  if (!BASE) return path;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/")) return `${BASE}${path}`;
  return `${BASE}/${path}`;
}

const TOKEN_KEY = "token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export const api = axios.create({
  baseURL: BASE || undefined,
  timeout: 120000,
});

/**
 * Request interceptor:
 * - attach Authorization Bearer token
 * - rewrite /api prefix if BASE already ends with /api
 */
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token) {
    if (!config.headers) config.headers = new AxiosHeaders();
    (config.headers as AxiosHeaders).set("Authorization", `Bearer ${token}`);
  }

  // If baseURL already ends with /api, avoid calling /api/api/...
  const b = (config.baseURL ?? api.defaults.baseURL ?? "").toString().replace(/\/+$/, "");
  const baseHasApi = /\/api$/i.test(b);
  if (baseHasApi && typeof config.url === "string") {
    if (config.url.startsWith("/api/")) config.url = config.url.slice(4); // remove "/api"
    else if (config.url === "/api") config.url = ""; // edge case
  }

  return config;
});

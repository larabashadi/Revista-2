// frontend/src/lib/api.ts
import axios, { type InternalAxiosRequestConfig } from "axios";

const RAW_BASE = String(import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
// Siempre trabajamos contra .../api
const API_ROOT = RAW_BASE.endsWith("/api") ? RAW_BASE : `${RAW_BASE}/api`;

// Acepta urls con /api/... y las normaliza para no duplicar /api
function normalizeUrlPath(url?: string) {
  if (!url) return url;
  // Si alguien llama a /api/templates, lo convertimos a /templates (porque baseURL ya es .../api)
  if (url === "/api") return "/";
  if (url.startsWith("/api/")) return url.slice(4);
  return url;
}

const TOKEN_KEY = "sms_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// axios instance
export const api = axios.create({
  baseURL: API_ROOT,
  timeout: 120000,
});

// auth header + normalización /api
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.url = normalizeUrlPath(config.url);

  const token = getToken();
  if (token) {
    // Cast a any para evitar peleas de typings con AxiosHeaders
    (config.headers as any) = {
      ...(config.headers as any),
      Authorization: `Bearer ${token}`,
    };
  }
  return config;
});

// Construye URLs ABSOLUTAS (importante para <img src=...> y Render)
export function apiUrl(path: string) {
  const p = normalizeUrlPath(path.startsWith("/") ? path : `/${path}`) || "/";
  return `${API_ROOT}${p}`;
}

// Para debug rápido si quieres mostrarlo en UI
export const API_BASE = API_ROOT;

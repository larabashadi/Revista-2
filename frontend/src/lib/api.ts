import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

/**
 * VITE_API_BASE debe ser la URL del BACKEND SIN /api
 * Ej: https://revista-2-1.onrender.com
 *
 * Este módulo:
 * - crea axios con baseURL = <origin>/api
 * - exporta apiUrl(path) como FUNCIÓN (para thumbs/assets/etc)
 * - evita el error TS2322 de headers en Axios v1
 */

function normalizeOrigin(raw: string): string {
  let b = String(raw || "").trim();
  if (!b) return "";
  b = b.replace(/\/+$/, "");      // quita slash final
  if (b.endsWith("/api")) b = b.slice(0, -4); // si te lo pasan con /api, lo quitamos
  return b;
}

export const API_ORIGIN: string =
  normalizeOrigin((import.meta as any)?.env?.VITE_API_BASE) || "";

// Base real para requests API (axios)
export const API_HTTP_BASE: string = API_ORIGIN ? `${API_ORIGIN}/api` : "/api";

// Si algún archivo necesita el string del base (compat)
export const apiBase = API_HTTP_BASE;

export function apiUrl(path: string = ""): string {
  // Si ya es URL absoluta, la devolvemos
  if (/^https?:\/\//i.test(path)) return path;

  const p = path.startsWith("/") ? path : `/${path}`;

  // Si viene como /api/..., no lo duplicamos
  if (p.startsWith("/api/")) {
    return API_ORIGIN ? `${API_ORIGIN}${p}` : p;
  }

  // Si viene como /assets/... o /templates/... lo asumimos bajo /api
  const full = `/api${p}`;
  return API_ORIGIN ? `${API_ORIGIN}${full}` : full;
}

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

export const api: AxiosInstance = axios.create({
  baseURL: API_HTTP_BASE,
  timeout: DEFAULT_TIMEOUT_MS,
});

const TOKEN_KEY = "token";

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token: string) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Interceptor: añade Authorization sin romper TS de Axios v1
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const t = getToken();
  if (t) {
    const headers: any = (config.headers ?? {}) as any;
    headers["Authorization"] = `Bearer ${t}`;
    config.headers = headers;
  }
  return config;
});

// compat: por si hay imports default
export default api;

import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

/**
 * Normaliza la base del backend:
 * - quita espacios
 * - quita trailing slash
 * - si te pasan .../api, lo deja en ... (para evitar /api/api)
 */
function normalizeBase(raw: string): string {
  let b = String(raw || "").trim();
  if (!b) return "";
  b = b.replace(/\/+$/, "");
  if (b.endsWith("/api")) b = b.slice(0, -4);
  return b;
}

export const API_BASE: string = normalizeBase((import.meta as any)?.env?.VITE_API_BASE);

/** Une API_BASE + path cuidando slashes. */
export function apiUrl(path: string = ""): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!API_BASE) return p; // fallback: dev/proxy
  return `${API_BASE}${p}`;
}

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 min (import PDF puede tardar)

/**
 * Axios instance usado en todo el frontend.
 * Importante: los endpoints del backend empiezan por /api/...
 */
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE || "",
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

/**
 * Interceptor: adjunta Authorization.
 * FIX TS2322: NO reasignar headers tipado a {} directamente.
 */
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const t = getToken();
  if (t) {
    const headers: any = (config.headers ?? {}) as any;
    headers["Authorization"] = `Bearer ${t}`;
    config.headers = headers;
  }
  return config;
});

/** Helper opcional para obtener data directamente. */
export async function unwrap<T>(p: Promise<AxiosResponse<T>>): Promise<T> {
  const r = await p;
  return r.data;
}

// compat: algunos archivos hacen `import api from "../lib/api"`
export default api;

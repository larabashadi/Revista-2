import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

/**
 * Base URL del backend (Render/Neon/Supabase, etc.)
 * - En producción se inyecta con VITE_API_BASE en el build.
 * - Ej: https://revista-2-1.onrender.com
 */
export const API_BASE: string = String((import.meta as any)?.env?.VITE_API_BASE || "")
  .trim()
  .replace(/\/$/, "");

/** Une API_BASE + path, cuidando slashes. */
export function apiUrl(path: string = ""): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!API_BASE) return p; // fallback (dev proxy)
  return `${API_BASE}${p}`;
}

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 min (import PDF puede tardar)

/**
 * Axios instance usado en todo el frontend.
 * OJO: en el código se llaman rutas tipo "/api/..."
 */
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE || "", // si está vacío, en dev puede usarse proxy
  timeout: DEFAULT_TIMEOUT_MS,
});

/** Token helpers (compatibles con código previo). */
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
 * Interceptor de request:
 * - Adjunta Authorization si hay token
 * - Evita el error TS2322 (no reasignar headers a {} tipado)
 */
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const t = getToken();
  if (t) {
    // Axios v1 usa AxiosHeaders internamente; para evitar TS, tratamos como any.
    const headers: any = (config.headers ?? {}) as any;
    headers["Authorization"] = `Bearer ${t}`;
    config.headers = headers;
  }
  return config;
});

/**
 * Helper: devuelve data directamente si quieres usarlo (opcional).
 */
export async function unwrap<T>(p: Promise<AxiosResponse<T>>): Promise<T> {
  const r = await p;
  return r.data;
}

// Compatibilidad por si algún archivo hacía `import api from "../lib/api"`
export default api;

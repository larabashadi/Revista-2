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
function normalizeOrigin(raw: string): string {
  let b = String(raw || "").trim();
  if (!b) return "";
  b = b.replace(/\/+$/, "");
  if (b.endsWith("/api")) b = b.slice(0, -4);
  return b;
}

export const API_ORIGIN: string = normalizeOrigin((import.meta as any)?.env?.VITE_API_BASE);

/**
 * Base URL REAL para llamadas API (siempre termina en /api)
 * - prod: https://revista-2-1.onrender.com/api
 * - dev (sin VITE_API_BASE): /api  (por si usas proxy)
 */
export const API_HTTP_BASE: string = API_ORIGIN ? `${API_ORIGIN}/api` : "/api";

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 min (import PDF puede tardar)

/**
 * Axios instance central.
 * IMPORTANTE: aquí la base ya incluye /api,
 * así que en el código se llama a "/me", "/templates", "/clubs", etc.
 */
export const api: AxiosInstance = axios.create({
  baseURL: API_HTTP_BASE,
  timeout: DEFAULT_TIMEOUT_MS,
});

/** Token helpers */
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
 * apiUrl: para construir URLs ABSOLUTAS (thumbnails, assets/file, etc.)
 * Soporta que le pases "/api/..." o "/assets/..." indistintamente.
 */
export function apiUrl(path: string = ""): string {
  const p = path.startsWith("/") ? path : `/${path}`;

  // Si ya viene con /api, lo respetamos
  const full = p.startsWith("/api/") ? p : `/api${p}`;

  // En dev sin origin, devolvemos relativo (mismo host)
  if (!API_ORIGIN) return full;

  return `${API_ORIGIN}${full}`;
}

/**
 * Interceptor:
 * - Adjunta Authorization si hay token
 * - Evita TS2322 (no reasignar headers tipado a {})
 * - Evita /api/api si alguien llama api.get("/api/me")
 */
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Evitar /api/api/... si algún callsite mete /api/ en la url
  if (config.url && config.url.startsWith("/api/")) {
    config.url = config.url.replace(/^\/api\//, "/");
  }

  const t = getToken();
  if (t) {
    const headers: any = (config.headers ?? {}) as any;
    headers["Authorization"] = `Bearer ${t}`;
    config.headers = headers;
  }
  return config;
});

/** Helper opcional para obtener data */
export async function unwrap<T>(p: Promise<AxiosResponse<T>>): Promise<T> {
  const r = await p;
  return r.data;
}

// compat: algunos archivos hacen `import api from "../lib/api"`
export default api;

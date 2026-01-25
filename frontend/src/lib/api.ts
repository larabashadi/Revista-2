// frontend/src/lib/api.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

/**
 * IMPORTANTE (Vite):
 * - VITE_API_BASE se inyecta en build-time.
 * - En Render Static Site, si cambias el env var, debes redeploy.
 */
const RAW_ORIGIN = String(import.meta.env.VITE_API_BASE ?? "").trim();
const API_ORIGIN = RAW_ORIGIN.replace(/\/+$/, ""); // quita slash final

// Base real del API (FastAPI expone /api/...)
export const API_BASE = API_ORIGIN ? `${API_ORIGIN}/api` : "/api";

// Para construir URLs absolutas a assets si hace falta
export const apiUrl = (path: string) => {
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_ORIGIN ? `${API_ORIGIN}${p}` : p;
};

const TOKEN_KEY = "token";

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token: string | null) => {
  try {
    if (!token) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore
  }
};

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000,
  withCredentials: false,
});

/**
 * Normaliza endpoints:
 * - Si alguien llama "/api/xxx" o "api/xxx", lo convertimos a "/xxx"
 *   porque baseURL ya incluye ".../api".
 */
function normalizeUrl(url?: string) {
  if (!url) return url;
  let u = url.trim();
  u = u.replace(/^\/?api\//, "/"); // "/api/x" -> "/x" | "api/x" -> "/x"
  if (!u.startsWith("/")) u = `/${u}`;
  return u;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.url = normalizeUrl(config.url);

  const token = getToken();
  if (token) {
    // Axios v1 usa AxiosHeaders; esto evita el TS2322
    const anyHeaders: any = config.headers ?? {};
    if (typeof anyHeaders.set === "function") {
      anyHeaders.set("Authorization", `Bearer ${token}`);
    } else {
      anyHeaders["Authorization"] = `Bearer ${token}`;
    }
    config.headers = anyHeaders;
  }

  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    // OJO: NO hacemos window.location.href (eso rompe el router y te da Not Found).
    // Sólo limpiamos token para que la app reaccione.
    if (err.response?.status === 401) {
      setToken(null);
    }
    return Promise.reject(err);
  }
);

export default api;

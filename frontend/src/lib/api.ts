import axios, { AxiosHeaders, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

/**
 * IMPORTANTE:
 * - En Render, VITE_API_BASE debe ser el HOST del backend, sin /api al final.
 *   Ej: https://revista-2-1.onrender.com
 */
function normalizeBase(u?: string) {
  return (u || "").trim().replace(/\/+$/, "");
}

export const apiUrl = normalizeBase(import.meta.env.VITE_API_BASE);

// Axios instance
export const api: AxiosInstance = axios.create({
  baseURL: apiUrl || undefined, // si está vacío, quedará relativo (y verás 404 en /templates, /clubs, etc)
  timeout: 10 * 60 * 1000, // 10 min (import PDF puede tardar)
});

// Token runtime + helpers
let _token: string | null = null;

export function getToken() {
  if (_token) return _token;
  const t = localStorage.getItem("access_token") || localStorage.getItem("token");
  _token = t;
  return t;
}

export function setToken(t: string | null) {
  _token = t;
  if (t) {
    localStorage.setItem("access_token", t);
    localStorage.setItem("token", t); // compat
  } else {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token");
  }
}

export function clearToken() {
  setToken(null);
}

// Request interceptor: Authorization
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const t = getToken();
  if (t) {
    // Aseguramos AxiosHeaders para evitar TS2322
    config.headers =
      config.headers instanceof AxiosHeaders
        ? config.headers
        : new AxiosHeaders(config.headers);

    config.headers.set("Authorization", `Bearer ${t}`);
  }
  return config;
});

// Export DEFAULT para que NO rompa imports antiguos:
// import api from "../lib/api"
export default api;

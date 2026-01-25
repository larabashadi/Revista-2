import axios, { InternalAxiosRequestConfig } from "axios";

/**
 * IMPORTANT:
 * - En Render debes definir VITE_API_BASE como la URL del BACKEND (sin /api)
 *   Ej: https://revista-2-1.onrender.com
 * - Este archivo añade /api automáticamente.
 */
const RAW_BASE =
  (import.meta as any).env?.VITE_API_BASE?.toString?.().trim?.() || "";

export const apiBase = (() => {
  const base = RAW_BASE.replace(/\/+$/, "");
  if (!base) return "/api"; // fallback (útil si sirves front+back en el mismo dominio)
  return `${base}/api`;
})();

export const apiUrl = apiBase; // alias por compatibilidad con imports antiguos

export const api = axios.create({
  baseURL: apiBase,
  timeout: 120000,
});

let _token: string | null = localStorage.getItem("token");

export function setToken(t: string | null) {
  _token = t;
  if (t) localStorage.setItem("token", t);
  else localStorage.removeItem("token");
}

export function getToken() {
  return _token ?? localStorage.getItem("token");
}

// Request interceptor: añade Authorization sin romper typings de Axios 1.x
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const t = getToken();
  if (t) {
    config.headers = config.headers ?? ({} as any);
    (config.headers as any).Authorization = `Bearer ${t}`;
  }
  return config;
});

export default api;

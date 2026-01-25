import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const rawBase = (import.meta.env.VITE_API_BASE || "").toString().trim();

// Base del backend (SIN /api). Ej: https://revista-2-1.onrender.com
export const API_BASE = rawBase.replace(/\/+$/, "") || window.location.origin;

// Mantengo este nombre porque en tu proyecto lo usan en varias partes
export const apiUrl = API_BASE;

let _token: string | null = null;

export function setToken(token: string | null) {
  _token = token;
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
}

// Normaliza rutas para que TODAS acaben en /api/...
function normalizeUrl(url: string): string {
  if (!url) return "/api";
  if (/^https?:\/\//i.test(url)) return url;

  let u = url.startsWith("/") ? url : `/${url}`;

  // Atajos (por si algún sitio llama /me o /login sin prefijos)
  if (u === "/me") return "/api/auth/me";
  if (u === "/login") return "/api/auth/login";
  if (u === "/register") return "/api/auth/register";

  // Si ya viene /api/... lo dejamos
  if (u.startsWith("/api/")) return u;

  // Si no, lo prefijamos
  return `/api${u}`;
}

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 180000, // PDFs grandes / export puede tardar
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof config.url === "string") {
    config.url = normalizeUrl(config.url);
  }

  const token = _token ?? localStorage.getItem("token");
  if (token) {
    config.headers = (config.headers ?? {}) as any;
    (config.headers as any)["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => Promise.reject(err)
);

export default api;

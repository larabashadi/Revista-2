import axios, { type InternalAxiosRequestConfig } from "axios";

const RAW = ((import.meta as any).env?.VITE_API_BASE as string | undefined) ?? "";
export const API_BASE = RAW.trim().replace(/\/+$/, ""); // sin slash final

function isAbsolute(url: string) {
  return /^https?:\/\//i.test(url);
}

export function apiUrl(path: string) {
  if (!path) return API_BASE;
  if (isAbsolute(path)) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

let _token: string | null = null;

export function getToken() {
  return _token ?? localStorage.getItem("token");
}

export function setToken(t: string | null) {
  _token = t;
  if (t) localStorage.setItem("token", t);
  else localStorage.removeItem("token");
}

export function clearToken() {
  setToken(null);
}

const api = axios.create({
  baseURL: API_BASE || undefined,
  timeout: 120000,
});

// 1) Fuerza prefijo /api en TODAS las rutas relativas.
// 2) Inyecta Authorization: Bearer <token>
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const url = (config.url ?? "").trim();

  if (url && !isAbsolute(url)) {
    const u = url.startsWith("/") ? url : `/${url}`;
    // si ya viene /api/... no lo duplicamos
    config.url = u === "/api" || u.startsWith("/api/") ? u : `/api${u}`;
  }

  const t = getToken();
  if (t) {
    config.headers = (config.headers ?? {}) as any;

    // compat con AxiosHeaders / objeto plano
    if (typeof (config.headers as any).set === "function") {
      (config.headers as any).set("Authorization", `Bearer ${t}`);
    } else {
      (config.headers as any)["Authorization"] = `Bearer ${t}`;
    }
  }

  return config;
});

export default api;
export { api };

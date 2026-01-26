import axios, { AxiosInstance } from "axios";

// Vite env
const RAW = (import.meta.env.VITE_API_BASE || "") as string;
export const API_BASE = RAW.trim().replace(/\/+$/, ""); // quita / final

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE || undefined,
  timeout: 120000,
});

let _token: string | null = null;

/** Guarda token para el interceptor y también en headers por defecto */
export function setToken(token: string | null) {
  _token = token;

  if (token) {
    (api.defaults.headers.common as any).Authorization = `Bearer ${token}`;
  } else {
    delete (api.defaults.headers.common as any).Authorization;
  }
}

/** Construye URL absoluta al backend (para <img src>, pdf, etc.) */
export function apiUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p;
}

api.interceptors.request.use((config) => {
  if (_token) {
    // Evita problemas de tipos de AxiosHeaders en TS
    if (!config.headers) config.headers = {} as any;
    (config.headers as any).Authorization = `Bearer ${_token}`;
  }
  return config;
});

export default api;

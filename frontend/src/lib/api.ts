// frontend/src/lib/api.ts
import axios, { AxiosInstance } from "axios";

const rawBase = (import.meta.env.VITE_API_BASE || "").trim();

// normaliza: quita slash final
export const API_BASE = rawBase.endsWith("/")
  ? rawBase.slice(0, -1)import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";

// Build-time env (Render lo inyecta al hacer build)
const RAW_BASE = (import.meta as any).env?.VITE_API_BASE ?? "";
export const API_BASE = String(RAW_BASE).replace(/\/+$/, ""); // sin trailing /

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE || undefined,
  timeout: 120000,
});

let _token: string | null = null;

export function setToken(token: string | null) {
  _token = token;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (_token) {
    // Evita problemas de types de AxiosHeaders en TS
    config.headers = (config.headers ?? {}) as any;
    (config.headers as any).Authorization = `Bearer ${_token}`;
  }
  return config;
});

export function apiUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p;
}

export default api;

  : rawBase;

export const apiUrl = (path: string) => {
  if (!API_BASE) return path; // fallback (dev local)
  if (!path.startsWith("/")) path = "/" + path;
  return API_BASE + path;
};

const tokenKey = "token";

export const getToken = () => localStorage.getItem(tokenKey) || "";
export const setToken = (t: string) => {
  if (!t) return;
  localStorage.setItem(tokenKey, t);
  api.defaults.headers.common.Authorization = `Bearer ${t}`;
};
export const clearToken = () => {
  localStorage.removeItem(tokenKey);
  delete api.defaults.headers.common.Authorization;
};

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE || "",
  withCredentials: false,
  timeout: 120000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    const headers = (config.headers ?? {}) as any;
    headers.Authorization = `Bearer ${token}`;
    config.headers = headers;
  }
  return config;
});

export default api;

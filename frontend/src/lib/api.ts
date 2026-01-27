import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

/**
 * Backend base URL.
 * Render: set VITE_API_BASE=https://<YOUR-BACKEND>.onrender.com
 * Local dev: can be empty and use Vite proxy / same origin.
 */
const baseURL = ((import.meta as any)?.env?.VITE_API_BASE as string | undefined) || "";

/** If you need to build absolute asset URLs (thumbnails, uploads). */
export const apiUrl: string = baseURL || "";

export const api = axios.create({
  baseURL,
  timeout: 120000,
});

// Keep token in module scope (also stored in localStorage by auth store)
let _token: string | null = null;

export function setToken(token: string | null) {
  _token = token;
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

// Attach bearer token on every request (works even if defaults were reset)
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token =
    _token ||
    (typeof window !== "undefined" ? localStorage.getItem("token") : null);

  if (token) {
    const headers: any = config.headers ?? {};
    headers.Authorization = `Bearer ${token}`;
    config.headers = headers;
  }
  return config;
});

export function getApiErrorMessage(err: any): string {
  const ax = err as AxiosError<any>;
  if (ax?.response?.data?.detail) return String(ax.response.data.detail);
  if (ax?.response?.data?.message) return String(ax.response.data.message);
  if (ax?.message) return String(ax.message);
  return "Network Error";
}

// Default export for legacy imports: `import api from "../lib/api"`
export default api;

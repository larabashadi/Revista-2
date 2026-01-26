import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";

const rawBase = (import.meta as any)?.env?.VITE_API_BASE ?? "";
const normalized =
  typeof rawBase === "string" ? rawBase.replace(/\/+$/, "") : "";

export const apiUrl =
  normalized ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:8000");

let _token: string | null = null;

export function setToken(token: string | null) {
  _token = token;
}

const api = axios.create({
  baseURL: apiUrl,
  // PDFs grandes / export pueden tardar
  timeout: 10 * 60 * 1000,
  maxBodyLength: Infinity,
  maxContentLength: Infinity,
  withCredentials: false,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (_token) {
    config.headers = (config.headers ?? {}) as any;
    (config.headers as any)["Authorization"] = `Bearer ${_token}`;
  }
  return config;
});

export default api;

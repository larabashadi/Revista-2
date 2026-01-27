import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";

const RAW = (import.meta as any)?.env?.VITE_API_BASE ?? "";
export const apiUrl = String(RAW || "").replace(/\/+$/, "");

let _token: string | null = null;

export function setToken(token: string | null) {
  _token = token;
}

const api = axios.create({
  baseURL: apiUrl || undefined,
  timeout: 10 * 60 * 1000,
  maxBodyLength: Infinity,
  maxContentLength: Infinity,
  withCredentials: false,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (_token) {
    config.headers = (config.headers ?? {}) as any;
    (config.headers as any).Authorization = `Bearer ${_token}`;
  }
  return config;
});

export default api;

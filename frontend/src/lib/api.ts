import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";

export const apiUrl = (import.meta as any).env?.VITE_API_BASE
  ? String((import.meta as any).env.VITE_API_BASE).replace(/\/$/, "")
  : ""; // si está vacío, usará mismo host (dev)

export const api: AxiosInstance = axios.create({
  baseURL: apiUrl || undefined,
  withCredentials: false,
  timeout: 120000,
});

let _token: string | null = null;

export function setToken(token: string | null) {
  _token = token;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const headers = (config.headers ?? {}) as any;
  if (_token) headers.Authorization = `Bearer ${_token}`;
  config.headers = headers;
  return config;
});

export const absApi = (u: string) => (u.startsWith("/api/") ? `${apiUrl}${u}` : u);

export default api;

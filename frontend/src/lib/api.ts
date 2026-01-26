// frontend/src/lib/api.ts
import axios, { AxiosInstance } from "axios";

const rawBase = (import.meta.env.VITE_API_BASE || "").trim();

// normaliza: quita slash final
export const API_BASE = rawBase.endsWith("/")
  ? rawBase.slice(0, -1)
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

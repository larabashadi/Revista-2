import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { API_BASE } from "../config";

// NOTE
// - In dev, Vite proxies `/api` to the backend (see vite.config.ts).
// - In production builds on Render, set VITE_API_BASE (e.g. https://<backend>.onrender.com)
//   so requests go to the API domain.
const baseURL = API_BASE || "";

// Store token under sms_token (and legacy token key for back-compat).
export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem("sms_token", token);
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("sms_token");
    localStorage.removeItem("token");
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("sms_token") || localStorage.getItem("token");
}

export const api = axios.create({
  baseURL,
  // Long operations (PDF import/export) can take time on Render. We override per-request too.
  timeout: 30000,
  withCredentials: false,
});

// Attach Authorization header if we have a token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token) {
    if ((config.headers as any)?.set) {
      (config.headers as any).set("Authorization", `Bearer ${token}`);
    } else {
      (config.headers as any) = { ...(config.headers as any), Authorization: `Bearer ${token}` };
    }
  }
  return config;
});

export default api;

import axios, { AxiosInstance } from "axios";

// Vite only exposes env vars prefixed with VITE_.
// IMPORTANT: env values are embedded at build-time.
const raw = (import.meta as any).env?.VITE_API_BASE || "";

// Normalize: remove trailing slashes to avoid "//api".
export const apiUrl: string = String(raw).replace(/\/+$/, "");

// If apiUrl is empty, we fall back to same-origin.
// This is useful when serving frontend through the backend.
const baseURL = apiUrl || "";

export const api: AxiosInstance = axios.create({
  baseURL,
  timeout: 120000, // 2 minutes for PDF/import/export operations
});

// Attach token if present.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any)["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

export function setToken(token: string | null) {
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
}

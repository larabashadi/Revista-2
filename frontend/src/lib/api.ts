import axios, {
  AxiosError,
  AxiosHeaders,
  InternalAxiosRequestConfig,
} from "axios";

/**
 * API base (backend). Debe ser algo como:
 *   https://revista-2-1.onrender.com
 */
export const API_BASE = String(import.meta.env.VITE_API_BASE || "")
  .trim()
  .replace(/\/+$/, "");

// Helper: build absolute URL to backend
export function apiUrl(path: string): string {
  const p = String(path || "").trim();
  if (!p) return API_BASE;
  if (/^https?:\/\//i.test(p)) return p; // already absolute
  const withSlash = p.startsWith("/") ? p : `/${p}`;
  return `${API_BASE}${withSlash}`;
}

// Axios instance (talks to backend)
export const api = axios.create({
  baseURL: API_BASE,
  timeout: 10 * 60 * 1000, // 10 min (PDF import can take time)
});

// Keep Authorization header synced
export function setToken(token: string | null) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
}

// Attach token automatically (axios v1 types)
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  if (token) {
    // Ensure headers is AxiosHeaders (not {})
    if (!config.headers) config.headers = new AxiosHeaders();
    if (config.headers instanceof AxiosHeaders) {
      config.headers.set("Authorization", `Bearer ${token}`);
    } else {
      // fallback (shouldn't happen often)
      (config.headers as any)["Authorization"] = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    // Optional: you can add centralized logging here
    return Promise.reject(err);
  }
);

// Default export for old imports: `import api from "../lib/api"`
export default api;

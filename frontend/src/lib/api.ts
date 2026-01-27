import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from "axios";

const rawBase = (import.meta as any).env?.VITE_API_BASE ?? "";
export const apiUrl: string = String(rawBase || "").replace(/\/+$/, "");

let token: string | null = null;

export const setToken = (t: string | null) => {
  token = t;
};

export const api = axios.create({
  baseURL: apiUrl || undefined,
  timeout: 120000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (token) {
    if (!config.headers) {
      config.headers = new AxiosHeaders();
    } else if (!(config.headers instanceof AxiosHeaders)) {
      config.headers = new AxiosHeaders(config.headers as any);
    }
    (config.headers as AxiosHeaders).set("Authorization", `Bearer ${token}`);
  }
  return config;
});

export default api;

import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { API_BASE } from "../config";
import { useAuth } from "../store/auth";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = (useAuth as any).getState?.()?.token;
  if (token) {
    // Axios v1 usa AxiosHeaders internamente; set() es lo correcto
    if (config.headers && typeof (config.headers as any).set === "function") {
      (config.headers as any).set("Authorization", `Bearer ${token}`);
    } else {
      (config.headers as any) = config.headers ?? {};
      (config.headers as any)["Authorization"] = `Bearer ${token}`;
    }
  }
  return config;
});

import axios from "axios";
import type { AxiosRequestConfig } from "axios";
import { API_BASE } from "../config";
import { useAuth } from "../store/auth";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
});

api.interceptors.request.use((config: AxiosRequestConfig) => {
  const token = (useAuth as any).getState?.()?.token;
  if (token) {
    (config.headers ??= {} as any);
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

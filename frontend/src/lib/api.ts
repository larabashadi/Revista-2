/*import axios from "axios";
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
const pushNet = (x: any) => {
  const w = window as any;
  w.__netlog__ = w.__netlog__ || [];
  w.__netlog__.push({ t: Date.now(), ...x });
};

api.interceptors.request.use((config) => {
  pushNet({ kind: "REQ", url: `${config.baseURL || ""}${config.url || ""}` });
  return config;
});

api.interceptors.response.use(
  (res) => {
    pushNet({ kind: "RES", url: `${res.config.baseURL || ""}${res.config.url || ""}`, status: res.status });
    return res;
  },
  (err) => {
    pushNet({
      kind: "ERR",
      url: `${err?.config?.baseURL || ""}${err?.config?.url || ""}`,
      status: err?.response?.status,
      msg: err?.message,
    });
    return Promise.reject(err);
  }
);*/
import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { API_BASE } from "../config";
import { useAuth } from "../store/auth";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
  timeout: 0, // import/export pueden tardar
});

// Añade token si existe
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = (useAuth as any).getState?.()?.token;

  if (token) {
    // Axios v1 usa AxiosHeaders internamente
    if ((config.headers as any)?.set) {
      (config.headers as any).set("Authorization", `Bearer ${token}`);
    } else {
      (config.headers as any) = { ...(config.headers as any), Authorization: `Bearer ${token}` };
    }
  }

  return config;
});

export default api;



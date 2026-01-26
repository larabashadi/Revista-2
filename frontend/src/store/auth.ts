import { create } from "zustand";
import api, { setToken, getToken } from "../lib/api";

export type Club = {
  id: string;
  name: string;
  sport: string;
  language: string;
  primary_color: string;
  secondary_color: string;
  font_primary: string;
  font_secondary: string;
  locked_logo_asset_id?: string | null;
  plan?: "free" | "pro";
};

export type User = {
  id: string;
  email: string;
  role?: "user" | "super_admin" | string;
};

type AuthState = {
  token: string | null;
  user: User | null;
  clubs: Club[];
  activeClubId: string | null;

  setActiveClub: (id: string) => void;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;

  loadMe: () => Promise<void>;
  loadClubs: () => Promise<void>;

  logout: () => void;
};

function extractToken(data: any): string | null {
  if (!data) return null;
  // FastAPI OAuth2PasswordBearer típico
  if (typeof data.access_token === "string") return data.access_token;
  // otros formatos
  if (typeof data.token === "string") return data.token;
  if (typeof data.jwt === "string") return data.jwt;
  return null;
}

function looksLikeHtml(resp: any): boolean {
  const ct = String(resp?.headers?.["content-type"] || "").toLowerCase();
  if (ct.includes("text/html")) return true;
  // si axios te devolvió string enorme y empieza por "<!doctype"
  if (typeof resp?.data === "string" && resp.data.trim().startsWith("<!doctype")) return true;
  return false;
}

async function tryLoginEndpoint(path: string, email: string, password: string) {
  const form = new URLSearchParams();
  form.set("username", email);
  form.set("password", password);

  return api.post(path, form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    validateStatus: () => true, // manejamos nosotros
  });
}

async function tryRegisterEndpoint(path: string, email: string, password: string) {
  return api.post(
    path,
    { email, password },
    { validateStatus: () => true }
  );
}

export const useAuth = create<AuthState>((set, get) => ({
  token: localStorage.getItem("token"),
  user: null,
  clubs: [],
  activeClubId: localStorage.getItem("activeClubId"),

  setActiveClub: (id) => {
    localStorage.setItem("activeClubId", id);
    set({ activeClubId: id });
  },

  login: async (email, password) => {
    const e = email.trim();
    if (!e || !password) throw new Error("Email y contraseña obligatorios.");

    // 1) Intento principal
    let resp = await tryLoginEndpoint("/auth/login", e, password);

    // Si 404, intento alternativo (por si tu backend expone /login)
    if (resp.status === 404) {
      resp = await tryLoginEndpoint("/login", e, password);
    }

    if (looksLikeHtml(resp)) {
      throw new Error(
        "El login está respondiendo HTML (parece que estás llamando al FRONT, no al BACKEND). Revisa VITE_API_BASE."
      );
    }

    if (resp.status < 200 || resp.status >= 300) {
      const detail = (resp.data && (resp.data.detail || resp.data.message)) || `HTTP ${resp.status}`;
      throw new Error(`Login falló: ${detail}`);
    }

    const token = extractToken(resp.data);
    if (!token) {
      throw new Error(
        "Login respondió 200 pero NO devolvió access_token. Estás llamando a un endpoint incorrecto o el backend no devuelve token."
      );
    }

    setToken(token);
    set({ token });

    await get().loadMe();
    await get().loadClubs();
  },

  register: async (email, password) => {
    const e = email.trim();
    if (!e || !password) throw new Error("Email y contraseña obligatorios.");

    let resp = await tryRegisterEndpoint("/auth/register", e, password);
    if (resp.status === 404) {
      resp = await tryRegisterEndpoint("/register", e, password);
    }

    if (looksLikeHtml(resp)) {
      throw new Error(
        "El register está respondiendo HTML (parece que estás llamando al FRONT, no al BACKEND). Revisa VITE_API_BASE."
      );
    }

    if (resp.status < 200 || resp.status >= 300) {
      const detail = (resp.data && (resp.data.detail || resp.data.message)) || `HTTP ${resp.status}`;
      throw new Error(`Registro falló: ${detail}`);
    }

    const token = extractToken(resp.data);
    if (token) {
      setToken(token);
      set({ token });
      await get().loadMe();
      await get().loadClubs();
      return;
    }

    // Si el backend registra pero no devuelve token, al menos intenta login
    await get().login(e, password);
  },

  loadMe: async () => {
    const token = get().token || getToken();
    if (!token) {
      set({ user: null });
      return;
    }
    try {
      setToken(token);
      const { data } = await api.get("/auth/me");
      set({ user: data || null });
    } catch {
      set({ user: null });
    }
  },

  loadClubs: async () => {
    const token = get().token || getToken();
    if (!token) return;

    setToken(token);
    const { data } = await api.get("/clubs");
    const clubs = Array.isArray(data) ? data : [];
    set({ clubs });

    const active = get().activeClubId;
    if (!active && clubs[0]?.id) {
      get().setActiveClub(clubs[0].id);
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("activeClubId");
    setToken("");
    set({ token: null, user: null, clubs: [], activeClubId: null });
  },
}));

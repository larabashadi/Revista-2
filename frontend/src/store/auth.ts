// frontend/src/store/auth.ts
import { create } from "zustand";
import api, { setToken, getToken } from "../lib/api";

export type User = {
  id: number;
  email: string;
  role: string;
};

export type Club = {
  id: number;
  name: string;
  // backend usa snake_case
  locked_logo_asset_id?: string | null;
};

type AuthState = {
  token: string | null;
  user: User | null;
  clubs: Club[];
  isReady: boolean;

  login: (email: string, password: string) => Promise<User>;
  logout: () => void;

  loadMe: () => Promise<void>;
  loadClubs: () => Promise<void>;
  init: () => Promise<void>;
};

export const useAuth = create<AuthState>((set, get) => ({
  token: getToken(),
  user: null,
  clubs: [],
  isReady: false,

  async login(email: string, password: string) {
    // FastAPI OAuth2PasswordRequestForm => x-www-form-urlencoded con "username"
    const body = new URLSearchParams();
    body.set("username", email);
    body.set("password", password);

    const res = await api.post("/auth/login", body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const token = (res.data as any)?.access_token;
    if (!token) throw new Error("Login: no se recibió access_token");

    setToken(token);
    set({ token });

    // Carga perfil
    await get().loadMe();
    await get().loadClubs();

    const u = get().user;
    if (!u) throw new Error("Login: no se pudo cargar el usuario");
    return u;
  },

  logout() {
    setToken(null);
    set({ token: null, user: null, clubs: [], isReady: true });
  },

  async loadMe() {
    const token = get().token ?? getToken();
    if (!token) return;

    const me = await api.get("/auth/me");
    set({ user: me.data });
  },

  async loadClubs() {
    const token = get().token ?? getToken();
    if (!token) return;

    const { data } = await api.get("/clubs");
    set({ clubs: Array.isArray(data) ? data : [] });
  },

  async init() {
    try {
      const token = getToken();
      if (token) {
        set({ token });
        await get().loadMe();
        await get().loadClubs();
      }
    } finally {
      set({ isReady: true });
    }
  },
}));

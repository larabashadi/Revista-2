import { create } from "zustand";
import api, { setToken, clearToken } from "../lib/api";

export type User = {
  id: string;
  email: string;
  is_active?: boolean;
  is_superuser?: boolean;
  role?: string; // por si lo usas en el front
};

export type Club = {
  id: string;
  name: string;
  logo_asset_id?: string | null;
  locked_logo_asset_id?: string | null;
  // si luego añades plan, puedes extender aquí sin romper
  plan?: string | null;
};

type AuthState = {
  token: string | null;
  user: User | null;
  clubs: Club[];
  activeClubId: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;

  loadMe: () => Promise<void>;
  loadClubs: () => Promise<void>;
  setActiveClub: (clubId: string | null) => void;
};

export const useAuth = create<AuthState>((set, get) => ({
  token: localStorage.getItem("access_token") || localStorage.getItem("token"),
  user: null,
  clubs: [],
  activeClubId: localStorage.getItem("active_club_id"),

  setActiveClub: (clubId) => {
    if (clubId) localStorage.setItem("active_club_id", clubId);
    else localStorage.removeItem("active_club_id");
    set({ activeClubId: clubId });
  },

  login: async (email, password) => {
    // FastAPI OAuth2PasswordRequestForm => x-www-form-urlencoded
    const form = new URLSearchParams();
    form.set("username", email);
    form.set("password", password);

    const res = await api.post("/api/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const token = res.data?.access_token;
    if (!token) {
      throw new Error("Login respondió pero NO devolvió access_token.");
    }

    setToken(token);
    set({ token });

    await get().loadMe();
    await get().loadClubs();
  },

  register: async (email, password) => {
    // El backend suele aceptar JSON en /api/auth/register
    await api.post("/api/auth/register", { email, password });
    // tras registrar, login automático
    await get().login(email, password);
  },

  logout: () => {
    clearToken();
    localStorage.removeItem("active_club_id");
    set({ token: null, user: null, clubs: [], activeClubId: null });
  },

  loadMe: async () => {
    const res = await api.get("/api/auth/me");
    set({ user: res.data });
  },

  loadClubs: async () => {
    const res = await api.get("/api/clubs");
    const clubs: Club[] = res.data || [];
    set({ clubs });

    // auto-selección si no hay activeClubId
    const cur = get().activeClubId;
    if (!cur && clubs.length > 0) {
      get().setActiveClub(clubs[0].id);
    }
  },
}));

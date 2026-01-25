import { create } from "zustand";
import api, { setToken } from "../lib/api";

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
    // Backend usa OAuth2PasswordRequestForm => x-www-form-urlencoded
    const form = new URLSearchParams();
    form.set("username", email);
    form.set("password", password);

    const { data } = await api.post("/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const token = data?.access_token as string;
    setToken(token);
    set({ token });

    await get().loadMe();
    await get().loadClubs();
  },

  register: async (email, password) => {
    // Backend /auth/register acepta JSON
    const { data } = await api.post("/auth/register", { email, password });

    const token = data?.access_token as string;
    setToken(token);
    set({ token });

    await get().loadMe();
    await get().loadClubs();
  },

  loadMe: async () => {
    const token = get().token;
    if (!token) {
      set({ user: null });
      return;
    }
    try {
      setToken(token);
      const { data } = await api.get("/auth/me");
      set({ user: data });
    } catch {
      set({ user: null });
    }
  },

  loadClubs: async () => {
    const token = get().token;
    if (!token) return;
    setToken(token);

    const { data } = await api.get("/clubs");
    set({ clubs: data || [] });

    // Auto-select primer club si no hay activo
    if (!get().activeClubId && data?.[0]?.id) {
      get().setActiveClub(data[0].id);
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("activeClubId");
    setToken(null);
    set({ token: null, user: null, clubs: [], activeClubId: null });
  },
}));

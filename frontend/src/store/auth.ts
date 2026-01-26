import { create } from "zustand";
import api, { setToken } from "../lib/api";

export type User = {
  id: string;
  email: string;
  role?: string | null;
};

export type Club = {
  id: string;
  name: string;
  sport?: string | null;
  language?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  font_primary?: string | null;
  font_secondary?: string | null;
  locked_logo_asset_id?: string | null;
  plan?: string | null;
};

export type AuthState = {
  token: string | null;
  user: User | null;
  clubs: Club[];
  activeClubId: string | null;

  setActiveClub: (clubId: string | null) => void;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;

  loadMe: () => Promise<void>;
  loadClubs: () => Promise<void>;
};

export const useAuth = create<AuthState>((set, get) => {
  const initialToken =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  if (initialToken) setToken(initialToken);

  return {
    token: initialToken,
    user: null,
    clubs: [],
    activeClubId:
      typeof window !== "undefined"
        ? localStorage.getItem("activeClubId")
        : null,

    setActiveClub: (clubId) => {
      const v = clubId ? String(clubId) : null;
      set({ activeClubId: v });

      if (typeof window !== "undefined") {
        if (v) localStorage.setItem("activeClubId", v);
        else localStorage.removeItem("activeClubId");
      }
    },

    async login(email, password) {
      // OAuth2PasswordRequestForm => x-www-form-urlencoded
      const form = new URLSearchParams();
      form.set("username", email);
      form.set("password", password);

      const res = await api.post("/api/auth/login", form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const token = (res.data as any)?.access_token;
      if (!token) {
        throw new Error(
          "Login respondió 200 pero NO devolvió access_token. Estás llamando a un endpoint incorrecto o backend no devuelve token."
        );
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("token", token);
      }

      setToken(token);
      set({ token });

      await get().loadMe();
      await get().loadClubs();
    },

    async register(email, password) {
      // Tu backend (zip) acepta SOLO email+password
      const res = await api.post("/api/auth/register", {
        email,
        password,
      });

      const token = (res.data as any)?.access_token;
      if (token) {
        if (typeof window !== "undefined") localStorage.setItem("token", token);
        setToken(token);
        set({ token });

        await get().loadMe();
        await get().loadClubs();
      }
    },

    logout() {
      // ⚠️ IMPORTANTE: setToken debe aceptar null en lib/api.ts
      setToken(null as any);

      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("activeClubId");
      }

      set({ token: null, user: null, clubs: [], activeClubId: null });
    },

    async loadMe() {
      if (!get().token) return;
      const res = await api.get("/api/auth/me");
      set({ user: res.data as User });
    },

    async loadClubs() {
      if (!get().token) return;

      const res = await api.get("/api/clubs");
      const clubs = (res.data as Club[]) || [];
      set({ clubs });

      // asegurar activeClubId existe
      const active = get().activeClubId;

      if (active && !clubs.some((c) => String(c.id) === String(active))) {
        get().setActiveClub(clubs[0]?.id ? String(clubs[0].id) : null);
      }

      if (!active && clubs.length > 0) {
        get().setActiveClub(String(clubs[0].id));
      }
    },
  };
});

import { create } from "zustand";
import api, { setToken } from "../lib/api";

export type Plan = "free" | "base" | "pro" | "enterprise";

export type User = {
  id: string;
  email: string;
  name?: string | null;
  is_admin: boolean;
  created_at?: string;
};

export type Club = {
  id: string;
  owner_user_id?: string;
  name: string;
  logo_asset_id?: string | null;
  locked_logo_asset_id?: string | null;
  chosen_template_id?: string | null;
  allow_export?: boolean;
  plan?: Plan;
  created_at?: string;
};

type RegisterPayload = {
  email: string;
  password: string;
  clubName?: string;
  clubLogoBase64?: string;
};

export type AuthState = {
  token: string | null;
  user: User | null;

  clubs: Club[];
  activeClubId: string | null;

  setActiveClub: (clubId: string | null) => void;
  activeClub: () => Club | null;

  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;

  loadMe: () => Promise<void>;
  loadClubs: () => Promise<void>;
};

export const useAuth = create<AuthState>((set, get) => ({
  token: localStorage.getItem("token"),
  user: null,

  clubs: [],
  activeClubId: localStorage.getItem("activeClubId"),

  setActiveClub: (clubId) => {
    if (clubId) localStorage.setItem("activeClubId", clubId);
    else localStorage.removeItem("activeClubId");
    set({ activeClubId: clubId });
  },

  activeClub: () => {
    const id = get().activeClubId;
    if (!id) return null;
    return get().clubs.find((c) => c.id === id) ?? null;
  },

  login: async (email, password) => {
    const res = await api.post("/api/auth/login", { email, password });
    const { token, user } = res.data as { token: string; user: User };

    setToken(token);
    set({ token, user });

    await get().loadClubs();
  },

  register: async (payload) => {
    const res = await api.post("/api/auth/register", payload);
    const { token, user } = res.data as { token: string; user: User };

    setToken(token);
    set({ token, user });

    await get().loadClubs();
  },

  logout: () => {
    setToken(null);
    localStorage.removeItem("activeClubId");
    set({
      token: null,
      user: null,
      clubs: [],
      activeClubId: null,
    });
  },

  loadMe: async () => {
    const t = get().token ?? localStorage.getItem("token");
    if (!t) {
      set({ user: null, token: null });
      return;
    }

    setToken(t);
    const res = await api.get("/api/auth/me");
    set({ user: res.data as User, token: t });
  },

  loadClubs: async () => {
    const res = await api.get("/api/clubs");
    const clubs = (res.data ?? []) as Club[];

    set({ clubs });

    const current = get().activeClubId || localStorage.getItem("activeClubId");
    const next =
      current && clubs.some((c) => c.id === current)
        ? current
        : clubs[0]?.id ?? null;

    if (next) localStorage.setItem("activeClubId", next);
    else localStorage.removeItem("activeClubId");

    set({ activeClubId: next });
  },
}));

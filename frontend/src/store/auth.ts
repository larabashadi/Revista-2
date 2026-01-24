import { create } from "zustand";
import { api } from "../lib/api";

type Club = {
  id: string; name: string; sport: string; language: string;
  primary_color: string; secondary_color: string;
  font_primary: string; font_secondary: string;
  locked_logo_asset_id?: string | null;
  plan: "free" | "pro";
};

type User = {
  id: string;
  email: string;
  role?: "user" | "super_admin";
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
  setActiveClub: (id) => { localStorage.setItem("activeClubId", id); set({ activeClubId: id }); },
  login: async (email, password) => {
    const form = new URLSearchParams();
    form.set("username", email);
    form.set("password", password);
    const { data } = await api.post("/api/auth/login", form, { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    localStorage.setItem("token", data.access_token);
   
    set({ token: data.access_token });
    await get().loadMe();
    await get().loadClubs();
  },
  register: async (email, password) => {
    const { data } = await api.post("/api/auth/register", { email, password });
    localStorage.setItem("token", data.access_token);
    
    set({ token: data.access_token });
    await get().loadMe();
    await get().loadClubs();
  },
  loadMe: async () => {
    const token = get().token;
    if (!token) { set({ user: null }); return; }
    try {
     
      const me = await api.get("/api/auth/me");
      set({ user: me.data });
    } catch {
      set({ user: null });
    }
  },

  loadClubs: async () => {
    const { token } = get();
    if (!token) return;
    
    const { data } = await api.get("/api/clubs");
    set({ clubs: data });
    if (!get().activeClubId && data?.[0]?.id) get().setActiveClub(data[0].id);
  },
  logout: () => { localStorage.removeItem("token"); localStorage.removeItem("activeClubId"); set({ token: null, user: null, clubs: [], activeClubId: null }); },
}));

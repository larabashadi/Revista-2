import { create } from "zustand";
import api, { setToken, clearToken, getToken } from "../lib/api";

export type User = {
  id: number;
  email: string;
  role?: string; // el backend sí devuelve role en /api/auth/me
};

export type Club = {
  id: number;
  name: string;
  plan?: string | null;
  logo_asset_id?: string | null;
  locked_logo_asset_id?: string | null;
};

type AuthState = {
  token: string | null;
  user: User | null;
  clubs: Club[];
  activeClubId: number | null;

  loading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  loadMe: () => Promise<void>;
  loadClubs: () => Promise<void>;
  createClub: (name: string) => Promise<Club>;
  setActiveClub: (clubId: number | null) => void;
  logout: () => void;
};

export const useAuth = create<AuthState>((set, get) => ({
  token: getToken(),
  user: null,
  clubs: [],
  activeClubId: null,

  loading: false,
  error: null,

  async login(email, password) {
    set({ loading: true, error: null });

    // FastAPI OAuth2PasswordRequestForm => form-urlencoded con username/password
    const body = new URLSearchParams();
    body.set("username", email);
    body.set("password", password);

    const res = await api.post("/auth/login", body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      // importante: si por error estás pegando al frontend, te puede devolver HTML con 200
      transformResponse: (r) => r,
      responseType: "text",
    });

    // Intentamos parsear JSON sí o sí
    let data: any = null;
    try {
      data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
    } catch {
      data = null;
    }

    if (!data?.access_token) {
      const url = (res.request as any)?.responseURL || "(sin URL)";
      const ct = res.headers?.["content-type"] || "(sin content-type)";
      throw new Error(
        `Login respondió ${res.status} pero NO devolvió access_token.\n` +
          `Request URL: ${url}\n` +
          `Content-Type: ${ct}\n` +
          `Body (primeros 200 chars): ${String(res.data).slice(0, 200)}`
      );
    }

    setToken(data.access_token);
    set({ token: data.access_token });

    await get().loadMe();
    await get().loadClubs();

    set({ loading: false });
  },

  async register(email, password) {
    set({ loading: true, error: null });

    // tu backend /api/auth/register devuelve TokenOut también
    const res = await api.post("/auth/register", { email, password });
    if (!res.data?.access_token) {
      throw new Error("Register no devolvió access_token.");
    }

    setToken(res.data.access_token);
    set({ token: res.data.access_token });

    await get().loadMe();
    await get().loadClubs();

    set({ loading: false });
  },

  async loadMe() {
    const t = getToken();
    if (!t) return;

    const res = await api.get("/auth/me"); // => /api/auth/me
    set({ user: res.data });
  },

  async loadClubs() {
    const t = getToken();
    if (!t) return;

    const res = await api.get("/clubs"); // => /api/clubs
    const clubs: Club[] = Array.isArray(res.data) ? res.data : [];
    const current = get().activeClubId;

    set({
      clubs,
      activeClubId: current ?? (clubs[0]?.id ?? null),
    });
  },

  async createClub(name: string) {
    const res = await api.post("/clubs", { name }); // => /api/clubs
    const club: Club = res.data;
    await get().loadClubs();
    set({ activeClubId: club.id });
    return club;
  },

  setActiveClub(clubId) {
    set({ activeClubId: clubId });
  },

  logout() {
    clearToken();
    set({ token: null, user: null, clubs: [], activeClubId: null });
  },
}));

export default useAuth;

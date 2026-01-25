import { useEffect, useMemo } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Editor from "./pages/Editor";
import AdminDashboard from "./pages/AdminDashboard";
import { useAuth } from "./store/auth";

function getApiBase(): string {
  const env = (import.meta as any)?.env?.VITE_API_BASE as string | undefined;
  const v = (env || "").trim();
  if (v) return v.replace(/\/$/, "");
  return "";
}

export default function App() {
  const nav = useNavigate();
  const loc = useLocation();
  const { token, logout, clubs, activeClubId, loadMe, loadClubs, me } = useAuth();

  useEffect(() => {
    // Cargar sesión y clubs
    if (token) {
      loadMe();
      loadClubs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const apiBase = getApiBase();

  const activeClub = useMemo(() => {
    if (!clubs?.length) return null;
    return clubs.find((c) => c.id === activeClubId) || clubs[0] || null;
  }, [clubs, activeClubId]);

  const clubLogoUrl = useMemo(() => {
    const id = (activeClub as any)?.locked_logo_asset_id;
    if (!id || !apiBase) return "";
    return `${apiBase}/api/assets/file/${id}`;
  }, [activeClub, apiBase]);

  const showAdmin = !!token && (me?.role === "super_admin" || me?.role === "admin");

  return (
    <div className="appRoot">
      <header className="topbar">
        <div className="topbarLeft">
          <div className="topbarLogoWrap" onClick={() => nav(token ? "/dashboard" : "/")} style={{ cursor: "pointer" }}>
            {clubLogoUrl ? (
              <img
                src={clubLogoUrl}
                alt="Logo club"
                style={{ width: 34, height: 34, borderRadius: 10, objectFit: "cover" }}
              />
            ) : (
              <div className="logoFallback">S</div>
            )}
          </div>

          <div className="topbarBrand">
            <div className="topbarTitle">Sports Magazine SaaS</div>
            <div className="topbarSub">Editor de revistas</div>
          </div>
        </div>

        <div className="topbarRight">
          {token ? (
            <>
              {loc.pathname !== "/dashboard" && (
                <button className="btn btnTop" onClick={() => nav("/dashboard")}>
                  Dashboard
                </button>
              )}
              {showAdmin && (
                <button className="btn btnTop" onClick={() => nav("/admin")}>
                  Admin
                </button>
              )}
              <button className="btn btnDanger" onClick={logout}>
                Salir
              </button>
            </>
          ) : (
            <>
              <button className="btn btnTop" onClick={() => nav("/login")}>
                Entrar
              </button>
              <button className="btn btnTopPrimary" onClick={() => nav("/register")}>
                Crear cuenta
              </button>
            </>
          )}
        </div>
      </header>

      <main className="appMain">
        <Routes>
          <Route path="/" element={token ? <Dashboard /> : <Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/editor/:projectId" element={<Editor />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </main>
    </div>
  );
}

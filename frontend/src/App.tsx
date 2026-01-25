import React, { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./store/auth";
import { apiUrl } from "./lib/api";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Editor from "./pages/Editor";
import AdminDashboard from "./pages/AdminDashboard";

function Topbar() {
  const { token, logout, clubs, activeClubId, user } = useAuth();
  const nav = useNavigate();

  const activeClub = clubs.find((c) => c.id === activeClubId) || null;
  const clubLogo = activeClub?.locked_logo_asset_id
    ? `${apiUrl || ""}/api/assets/file/${activeClub.locked_logo_asset_id}`
    : null;

  return (
    <div className="topbar">
      <div className="brand" onClick={() => nav("/")}>
        {clubLogo ? (
          <img
            src={clubLogo}
            alt="Logo del club"
            className="club-logo"
            loading="lazy"
            onError={(e) => {
              // If the asset fails to load, fall back to the default avatar.
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="brand-avatar" aria-hidden="true">S</div>
        )}
        <div className="brand-text">
          <div className="brand-title">Sports Magazine SaaS</div>
          <div className="brand-sub">Editor de revistas</div>
        </div>
        <span className="pill">v10.4.7</span>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        {token ? (
          <>
            <button className="btn" onClick={() => nav("/")}>Dashboard</button>
            {user?.role === "super_admin" && (
              <button className="btn" onClick={() => nav("/admin")}>Admin</button>
            )}
            <button className="btn danger" onClick={() => { logout(); nav("/login"); }}>Salir</button>
          </>
        ) : (
          <button className="btn" onClick={() => nav("/login")}>Entrar</button>
        )}
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const loc = useLocation();
  if (!token) return <Navigate to="/login" replace />;
  if (user?.role === "super_admin" && !loc.pathname.startsWith("/admin")) {
    return <Navigate to="/admin" replace />;
  }
  if (user?.role !== "super_admin" && loc.pathname.startsWith("/admin")) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { token, loadClubs, loadMe } = useAuth();
  useEffect(() => {
    if (!token) return;
    // Ensure role-based routing works and clubs are loaded after refresh.
    loadMe().catch(() => void 0);
    loadClubs().catch(() => void 0);
  }, [token]);
  return (
    <>
      <Topbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/editor/:projectId" element={<RequireAuth><Editor /></RequireAuth>} />
        <Route path="/admin" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

import React, { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./store/auth";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Editor from "./pages/Editor";
import AdminDashboard from "./pages/AdminDashboard";

function Topbar() {
  const { token, logout, user } = useAuth();
  const nav = useNavigate();

  return (
    <div className="topbar">
      <div className="brand" onClick={() => nav("/")}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            background: "rgba(91,140,255,.18)",
            border: "1px solid rgba(91,140,255,.35)",
          }}
        />
        <div>Sports Magazine SaaS</div>
        <span className="pill">v10.4.7</span>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {token ? (
          <>
            <button className="btn" onClick={() => nav("/")}>Dashboard</button>
            {user?.role === "super_admin" ? (
              <button className="btn" onClick={() => nav("/admin")}>Admin</button>
            ) : null}
            <button className="btn danger" onClick={() => { logout(); nav("/login"); }}>
              Salir
            </button>
          </>
        ) : (
          <>
            <button className="btn" onClick={() => nav("/login")}>Entrar</button>
          </>
        )}
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { token, loadClubs, loadMe } = useAuth();
  const loc = useLocation();

  useEffect(() => {
    if (!token) return;
    loadMe().catch(() => void 0);
    loadClubs().catch(() => void 0);
  }, [token]);

  // Evita quedarse “en blanco” si hay rutas raras
  // (y deja /editor/:id funcionando)
  if (!token && loc.pathname.startsWith("/editor")) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <Topbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/editor/:projectId" element={<RequireAuth><Editor /></RequireAuth>} />
        <Route path="/admin" element={<RequireAuth><AdminDashboard /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

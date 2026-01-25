import React, { useEffect } from "react";
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Editor from "./pages/Editor";
import AdminDashboard from "./pages/AdminDashboard";

import { useAuth } from "./store/auth";
import { apiUrl } from "./config";

function Topbar() {
  const nav = useNavigate();
  const { token, user, logout } = useAuth();

  // Intentamos sacar el logo “seleccionado” desde donde suele venir en proyectos así:
  // - user.club.logo_asset_id
  // - user.club_logo_asset_id / logo_asset_id
  // - club.locked_logo_asset_id (fallback)
  const logoAssetId =
    (user as any)?.club?.logo_asset_id ||
    (user as any)?.club?.locked_logo_asset_id ||
    (user as any)?.club_logo_asset_id ||
    (user as any)?.logo_asset_id ||
    (user as any)?.locked_logo_asset_id;

  const logoSrc = logoAssetId ? apiUrl(`/api/assets/file/${logoAssetId}`) : null;

  return (
    <header className="topbar">
      <div className="topbarLeft" onClick={() => nav("/")}>
        {logoSrc ? (
          <div className="topbarLogoWrap" title="Logo del club">
            <img className="topbarLogo" src={logoSrc} alt="Club logo" />
          </div>
        ) : (
          <div className="topbarLogoFallback" aria-hidden="true">
            S
          </div>
        )}

        <div className="brandText">
          <div className="brandTitle">Sports Magazine SaaS</div>
          <div className="brandSub">Editor de revistas</div>
        </div>
      </div>

      <div className="topActions">
        {token ? (
          <>
            <button className="btn btnTop" onClick={() => nav("/")}>
              Dashboard
            </button>

            {user?.role === "super_admin" && (
              <button className="btn btnTop btnTopAdmin" onClick={() => nav("/admin")}>
                Admin
              </button>
            )}

            <button
              className="btn btnTop btnTopDanger"
              onClick={() => {
                logout();
                nav("/login");
              }}
            >
              Salir
            </button>
          </>
        ) : (
          <>
            <button className="btn btnTop btnTopPrimary" onClick={() => nav("/login")}>
              Entrar
            </button>
            <button className="btn btnTop" onClick={() => nav("/register")}>
              Crear cuenta
            </button>
          </>
        )}
      </div>
    </header>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { token, loadMe } = useAuth();

  useEffect(() => {
    if (!token) return;
    loadMe().catch(() => void 0);
  }, [token, loadMe]);

  return (
    <>
      <Topbar />

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />

        <Route
          path="/editor/:projectId"
          element={
            <PrivateRoute>
              <Editor />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <PrivateRoute>
              <AdminDashboard />
            </PrivateRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

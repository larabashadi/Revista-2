import { useEffect, useMemo } from "react";
import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "./store/auth";
import Dashboard from "./pages/Dashboard";
import Editor from "./pages/Editor";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import { apiUrl } from "./lib/api";

function Topbar() {
  const { token, user, clubs, activeClubId, logout } = useAuth();
  const location = useLocation();

  const activeClub = useMemo(() => {
    if (!activeClubId) return null;
    return clubs.find((c) => String(c.id) === String(activeClubId)) ?? null;
  }, [clubs, activeClubId]);

  const clubLogo = activeClub?.locked_logo_asset_id
    ? `${apiUrl}/api/assets/file/${activeClub.locked_logo_asset_id}`
    : null;

  const isAuthed = !!token;
  const isAdmin = (user?.role ?? "").toLowerCase() === "admin";

  return (
    <div className="topbar">
      <div className="topbarInner">
        <div className="brand">
          <div className="brandLogo">
            {clubLogo ? (
              <img
                src={clubLogo}
                alt="Club logo"
                className="brandLogoImg"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="brandMark" />
            )}
          </div>
          <div className="brandText">
            <div className="brandTitle">Sports Magazine</div>
            <div className="brandSub">
              {activeClub?.name ? activeClub.name : "Editor"}
            </div>
          </div>
        </div>

        <div className="topbarRight">
          {isAuthed ? (
            <>
              <Link className="btn" to="/dashboard">
                Panel
              </Link>

              {/* si quieres ocultar Admin siempre, comenta este bloque */}
              {isAdmin && (
                <Link className="btn" to="/admin">
                  Admin
                </Link>
              )}

              <button
                className="btn btnPrimary"
                onClick={() => {
                  logout();
                }}
              >
                Salir
              </button>
            </>
          ) : (
            <>
              {/* Evita mostrar botón Login si ya estás en /login */}
              {location.pathname !== "/login" && (
                <Link className="btn btnPrimary" to="/login">
                  Entrar
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { token, loadMe, loadClubs } = useAuth();

  useEffect(() => {
    if (!token) return;
    // cargar user + clubs tras login
    loadMe().catch(() => void 0);
    loadClubs().catch(() => void 0);
  }, [token, loadMe, loadClubs]);

  return (
    <div className="appRoot">
      <Topbar />
      <div className="appBody">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />

          <Route
            path="/dashboard"
            element={token ? <Dashboard /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/editor/:projectId"
            element={token ? <Editor /> : <Navigate to="/login" replace />}
          />

          <Route
            path="/admin"
            element={token ? <AdminDashboard /> : <Navigate to="/login" replace />}
          />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
}

import React, { useEffect } from "react";
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Editor from "./pages/Editor";
import AdminDashboard from "./pages/AdminDashboard";

import { useAuth } from "./store/auth";

function Topbar() {
  const nav = useNavigate();
  const { token, user, logout } = useAuth();

  return (
    <div className="topbar">
      <div className="brand" onClick={() => nav("/")}>
        <div className="logoDot" />
        <div>
          <div className="brandTitle">Sports Magazine SaaS</div>
          <div className="brandSub">Editor de revistas</div>
        </div>
      </div>

      <div className="topActions">
        {token ? (
          <>
            <button className="btn" onClick={() => nav("/")}>Dashboard</button>

            {user?.role === "super_admin" && (
              <button className="btn" onClick={() => nav("/admin")}>Admin</button>
            )}

            <button
              className="btn danger"
              onClick={() => {
                logout();
                nav("/login");
              }}
            >
              Salir
            </button>
          </>
        ) : (
          <button className="btn" onClick={() => nav("/login")}>Entrar</button>
        )}
      </div>
    </div>
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

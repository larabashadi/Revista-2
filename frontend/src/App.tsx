import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";

import Login from "./pages/Login";

import Dashboard from "./pages/Dashboard";
import Editor from "./pages/Editor";
import AdminDashboard from "./pages/AdminDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: "100vh", background: "#0b1020", color: "#fff" }}>
        <TopNav />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
         
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/editor/:magazineId" element={<Editor />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

function TopNav() {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "rgba(11,16,32,0.8)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255,255,255,0.10)",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 16px", display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ fontWeight: 800, letterSpacing: 0.4 }}>Sports Magazine SaaS</div>
        <div style={{ flex: 1 }} />
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/admin">Admin</NavLink>
        <NavLink to="/login">Login</NavLink>
      </div>
    </div>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      style={{
        textDecoration: "none",
        color: "rgba(255,255,255,0.90)",
        padding: "6px 10px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.10)",
      }}
    >
      {children}
    </Link>
  );
}

function NotFound() {
  return <div style={{ padding: 24 }}>404</div>;
}

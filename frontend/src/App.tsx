// frontend/src/App.tsx
import { useEffect } from "react";
import { useAuth } from "./store/auth";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Editor from "./pages/Editor";
import AdminDashboard from "./pages/AdminDashboard";

export default function App() {
  const token = useAuth((s) => s.token);
  const user = useAuth((s) => s.user);
  const loadMe = useAuth((s) => s.loadMe);
  const loadClubs = useAuth((s) => s.loadClubs);

  useEffect(() => {
    if (!token) return;

    // Hydrate session after refresh
    loadMe().catch(() => {});
    loadClubs().catch(() => {});
  }, [token, loadMe, loadClubs]);

  // Not logged in
  if (!token) return <Login />;

  // Very simple routing without react-router (stable on Render)
  const path = window.location.pathname;

  // If you want to hard-hide admin entry after login unless admin:
  // (won't break if backend doesn't send role)
  const isAdmin = (user as any)?.role === "admin" || (user as any)?.is_admin === true;

  if (path.startsWith("/admin")) {
    return isAdmin ? <AdminDashboard /> : <Dashboard />;
  }

  if (path.startsWith("/editor")) return <Editor />;

  // default
  return <Dashboard />;
}

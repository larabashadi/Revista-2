import { useEffect } from "react";
import { useAuth } from "./store/auth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Editor from "./pages/Editor";
import AdminDashboard from "./pages/AdminDashboard";

function App() {
  const token = useAuth((s) => s.token);
  const user = useAuth((s) => s.user);
  const loadMe = useAuth((s) => s.loadMe);
  const loadClubs = useAuth((s) => s.loadClubs);

  useEffect(() => {
    if (token) {
      loadMe().catch(() => {});
      loadClubs().catch(() => {});
    }
  }, [token]);

  if (!token) return <Login />;

  const path = window.location.pathname;
  if (path.startsWith("/admin")) return <AdminDashboard />;

  if (path.startsWith("/editor")) return <Editor />;
  return <Dashboard />;
}

export default App;

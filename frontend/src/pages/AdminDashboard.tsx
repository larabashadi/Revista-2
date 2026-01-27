import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../store/auth";

type UserRow = {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
};

type ClubRow = {
  id: string;
  name: string;
  owner_user_id?: string | null;
  templates_locked?: boolean | null;
  chosen_template_id?: string | null;
  export_enabled?: boolean | null;
};

export default function AdminDashboard() {
  const { token, user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        setErr(null);
        const u = await api.get("/api/admin/users");
        const c = await api.get("/api/admin/clubs");
        setUsers((u.data as any) || []);
        setClubs((c.data as any) || []);
      } catch (e: any) {
        setErr(
          `No se pudo cargar admin. ${
            e?.response?.status ? `[${e.response.status}]` : ""
          } ${e?.message || ""}`.trim()
        );
      }
    })();
  }, [token]);

  if (!token) return <div className="container">No autorizado.</div>;
  if ((user?.role || "").toLowerCase() !== "admin") {
    return <div className="container">Solo admin.</div>;
  }

  return (
    <div className="container">
      <div className="panel">
        <h2>Admin</h2>
        {err && <div style={{ color: "#ffb4b4" }}>{err}</div>}

        <h3 style={{ marginTop: 18 }}>Usuarios</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Email</th>
                <th style={{ textAlign: "left" }}>Nombre</th>
                <th style={{ textAlign: "left" }}>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.name || ""}</td>
                  <td>{u.role || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 style={{ marginTop: 18 }}>Clubs</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Nombre</th>
                <th style={{ textAlign: "left" }}>Templates locked</th>
                <th style={{ textAlign: "left" }}>Chosen template</th>
                <th style={{ textAlign: "left" }}>Export enabled</th>
              </tr>
            </thead>
            <tbody>
              {clubs.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{String(!!c.templates_locked)}</td>
                  <td>{c.chosen_template_id || ""}</td>
                  <td>{String(!!c.export_enabled)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

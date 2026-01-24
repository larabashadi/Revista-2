import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import { useNavigate } from "react-router-dom";

type UserRow = { id: string; email: string; role: string; created_at?: string };
type ClubRow = { id: string; name: string; owner_id: string; plan: string; templates_locked: boolean; chosen_template_id?: string|null; allowed_template_ids?: string|null };

export default function AdminDashboard() {
  const nav = useNavigate();
  const { token, user, loadMe } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [err, setErr] = useState<string>("");

  useEffect(() => { (async () => { await loadMe(); })(); }, []);
  useEffect(() => {
    if (!token) nav("/login");
  }, [token]);

  useEffect(() => {
    if (user && user.role !== "super_admin") nav("/");
  }, [user]);

  async function refresh() {
    setErr("");
    try {
      const u = await api.get("/api/admin/users");
setUsers(u.data || []);

    } catch (e: any) {
      setErr(e?.message || "No puedo cargar usuarios");
    }
    try {
     const c = await api.get("/api/admin/clubs");
setClubs(c.data || []);

    } catch (e: any) {
      // clubs endpoint may not exist yet on older DB; ignore
    }
  }

  useEffect(() => { refresh(); }, [user?.role]);

  async function setRole(userId: string, role: string) {
    setErr("");
    try {
      await api.post(`/api/admin/users/${userId}/role`, { role });
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "Error cambiando rol");
    }
  }

  async function setAllowedTemplates(clubId: string, raw: string) {
    setErr("");
    let ids: string[] | null = null;
    const cleaned = raw.trim();
    if (cleaned) {
      ids = cleaned.split(",").map(s => s.trim()).filter(Boolean);
      if (ids.length === 0) ids = null;
    }
    try {
      await api.patch(`/api/admin/clubs/${clubId}/allowed-templates`, { allowed_template_ids: ids });
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "Error guardando permisos de plantillas");
    }
  }

  const clubsByOwner = useMemo(() => {
    const m = new Map<string, ClubRow>();
    clubs.forEach(c => m.set(c.owner_id, c));
    return m;
  }, [clubs]);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Panel Super Admin</h2>
        <button onClick={() => { useAuth.getState().logout(); nav("/login"); }}>Cerrar sesión</button>
      </div>

      {err ? <div style={{ padding: 10, background: "rgba(220,38,38,.10)", border: "1px solid rgba(220,38,38,.35)", borderRadius: 10, marginBottom: 12 }}>{err}</div> : null}

      <div style={{ background: "var(--bg1)", border: "1px solid var(--bg2)", borderRadius: 14, boxShadow: "var(--shadow)", padding: 14 }}>
        <h3 style={{ marginTop: 0 }}>Usuarios</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--bg2)" }}>Email</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--bg2)" }}>Rol</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--bg2)" }}>Permisos plantillas (club)</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const club = clubsByOwner.get(u.id);
                return (
                  <tr key={u.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--bg2)" }}>{u.email}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--bg2)" }}>
                      <select value={u.role} onChange={(e) => setRole(u.id, e.target.value)}>
                        <option value="user">user</option>
                        <option value="super_admin">super_admin</option>
                      </select>
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--bg2)" }}>
                      {!club ? <span style={{ color: "var(--muted)" }}>—</span> : (
                        <AllowedTemplatesEditor club={club} onSave={(raw) => setAllowedTemplates(club.id, raw)} />
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: 12, color: "var(--muted)" }}>Sin usuarios todavía</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p style={{ color: "var(--muted)", marginBottom: 0 }}>
          * “Permisos plantillas” admite IDs separados por coma. Vacío = acceso a todas.
        </p>
      </div>
    </div>
  );
}

function AllowedTemplatesEditor({ club, onSave }: { club: ClubRow; onSave: (raw: string) => void }) {
  const [v, setV] = useState<string>(() => {
    try {
      const ids = club.allowed_template_ids ? JSON.parse(club.allowed_template_ids) : null;
      if (Array.isArray(ids)) return ids.join(", ");
    } catch {}
    return "";
  });
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="id1, id2, id3" style={{ width: 320 }} />
      <button onClick={() => onSave(v)}>Guardar</button>
    </div>
  );
}

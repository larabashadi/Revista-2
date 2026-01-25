import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";

export default function Login() {
  const nav = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      const u = (useAuth as any).getState().user;
      nav(u?.role === "super_admin" ? "/admin" : "/");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="layout" style={{ gridTemplateColumns: "1fr" }}>
      <div className="main" style={{ maxWidth: 560, margin: "0 auto" }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Entrar</h2>

          <div className="field">
            <label>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="club@correo.com"
            />
          </div>

          <div className="field">
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
            />
          </div>

          {err && <div style={{ color: "#ff8aa0", marginBottom: 10 }}>{err}</div>}

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn primary" onClick={submit} disabled={busy}>
              {busy ? "Entrando..." : "Entrar"}
            </button>
            <button className="btn" onClick={() => nav("/register")} disabled={busy}>
              Crear cuenta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

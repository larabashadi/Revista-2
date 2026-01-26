import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";

export default function Register() {
  const nav = useNavigate();
  const { register } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await register(email.trim(), password, name.trim() || undefined);
      nav("/dashboard");
    } catch (e: any) {
      setErr(e?.message || "No se pudo registrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container">
      <div className="panel" style={{ maxWidth: 520, margin: "24px auto" }}>
        <h2>Registro</h2>

        {err && (
          <div style={{ marginTop: 10, color: "#ffb4b4" }}>
            {err}
          </div>
        )}

        <form onSubmit={onSubmit} style={{ marginTop: 12 }}>
          <div className="field">
            <label>Nombre del club (opcional)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary" disabled={busy}>
              {busy ? "Creando..." : "Crear cuenta"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => nav("/login")}
              disabled={busy}
            >
              Ya tengo cuenta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

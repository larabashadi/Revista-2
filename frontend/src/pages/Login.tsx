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

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setErr(null);
    setBusy(true);

    try {
      await login(email, password);
      const state = (useAuth as any).getState();
      const role = state?.user?.role;
      nav(role === "super_admin" ? "/admin" : "/");
    } catch (ex: any) {
      setErr(ex?.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="layout" style={{ gridTemplateColumns: "1fr" }}>
      <div className="main" style={{ maxWidth: 560, margin: "0 auto" }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Entrar</h2>

          <form onSubmit={submit}>
            <div className="field">
              <label>Email</label>
              <input
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                placeholder="club@correo.com"
                autoComplete="email"
              />
            </div>

            <div className="field">
              <label>Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                placeholder="********"
                autoComplete="current-password"
              />
            </div>

            {err && (
              <div style={{ color: "#ff8aa0", marginBottom: 12, whiteSpace: "pre-wrap" }}>
                {err}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn primary" type="submit" disabled={busy}>
                {busy ? "Entrando..." : "Entrar"}
              </button>
              <button className="btn" type="button" disabled={busy} onClick={() => nav("/register")}>
                Crear cuenta
              </button>
            </div>
          </form>

          <div style={{ opacity: 0.8, marginTop: 14, fontSize: 12 }}>
            Si al entrar te dice que responde HTML, es que estás llamando al FRONT en vez del BACKEND.
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";

export default function Register() {
  const nav = useNavigate();
  const { register } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const onSubmit = async () => {
    setErr("");
    try {
      await register(email, password);
      nav("/");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || "Error registrando");
    }
  };

  return (
    <div className="layout" style={{ gridTemplateColumns: "1fr" }}>
      <div className="main" style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Crear cuenta</h2>

          <div className="field">
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="field">
            <label>Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {err && <div style={{ color: "#ff8aa0", marginBottom: 10 }}>{err}</div>}

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn primary" onClick={onSubmit}>Crear</button>
            <button className="btn" onClick={() => nav("/login")}>Ya tengo cuenta</button>
          </div>
        </div>
      </div>
    </div>
  );
}

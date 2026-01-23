import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";

export default function Login() {
  const nav = useNavigate();
  const { login, register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    try {
      if (isRegister) await register(email, password);
      else await login(email, password);
      const u = (useAuth as any).getState().user;
      nav(u?.role === "super_admin" ? "/admin" : "/");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Error");
    }
  }

  return (
    <div className="layout" style={{gridTemplateColumns:"1fr"}}>
      <div className="main" style={{maxWidth:560, margin:"0 auto"}}>
        <div className="card">
          <h2 style={{marginTop:0}}>{isRegister ? "Crear cuenta" : "Entrar"}</h2>
          <p style={{color:"var(--muted)", marginTop:0}}>
            Editor para revistas deportivas (plantillas nativas 40+ páginas + import PDF + export premium).
          </p>
          <div className="field">
            <label>Email</label>
            <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="club@correo.com" />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="********" />
          </div>
          {err && <div style={{color:"#ff8aa0", marginBottom:10}}>{err}</div>}
          <div style={{display:"flex", gap:10}}>
            <button className="btn primary" onClick={submit}>{isRegister ? "Crear" : "Entrar"}</button>
            <button className="btn" onClick={()=>setIsRegister(!isRegister)}>
              {isRegister ? "Ya tengo cuenta" : "Crear cuenta"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

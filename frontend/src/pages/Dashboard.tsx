import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, apiUrl } from "../lib/api";
import { useAuth } from "../store/auth";

type Template = { id: string; name: string; origin: string; sport: string; pages: number };

function Toast({ msg }: { msg: string }) {
  return <div className="toast">{msg}</div>;
}

export default function Dashboard() {
  const nav = useNavigate();
  const { clubs, activeClubId, setActiveClub, loadClubs } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [style, setStyle] = useState("minimal_premium");
  const [sport, setSport] = useState("football");
  const [isGenerating, setIsGenerating] = useState(false);
  const [genOptions, setGenOptions] = useState<any[] | null>(null);

  const activeClub = useMemo(() => clubs.find(c => c.id === activeClubId) || null, [clubs, activeClubId]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/api/templates");
        setTemplates(data);
      } catch (e: any) {
        setToast(e?.response?.data?.detail || "No se pudieron cargar las plantillas (API)");
        setTimeout(()=>setToast(null), 2500);
      }
    })();
  }, []);

  async function createClubQuick() {
    const name = prompt("Nombre del club:", "Mi Club") || "Mi Club";
    try {
      const res = await api.post("/api/clubs", { name, sport: "football", language: "es" });
      // Activate immediately so the user can pick a template without re-login
      setActiveClub(res.data.id);
      await loadClubs();
      setToast("Club creado ✅");
    } catch (e: any) {
      setToast(e?.response?.data?.detail || "No se pudo crear el club");
    } finally {
      setTimeout(()=>setToast(null), 2500);
    }
  }

  async function uploadLockedLogo() {
    if (!activeClubId) {
      setToast("Primero crea/selecciona un club");
      setTimeout(()=>setToast(null), 2500);
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append("file", file);
      try {
        await api.post(`/api/clubs/${activeClubId}/locked-logo`, fd);
        await loadClubs();
        setToast("Logo portada actualizado ✅");
      } catch (e: any) {
        setToast(e?.response?.data?.detail || "No se pudo subir el logo");
      } finally {
        setTimeout(()=>setToast(null), 2500);
      }
    };
    input.click();
  }

  async function createProjectFromTemplate(templateId: string, name: string) {
    if (!activeClubId) {
      setToast("Primero crea/selecciona un club");
      setTimeout(()=>setToast(null), 2500);
      return;
    }
    try {
      const { data } = await api.post(`/api/projects/${activeClubId}`, { template_id: templateId, name });
      nav(`/editor/${data.id}`);
    } catch (e: any) {
      setToast(e?.response?.data?.detail || "No se pudo crear el proyecto");
      setTimeout(()=>setToast(null), 2500);
    }
  }

  async function importPdf(mode: string) {
    if (!activeClubId) {
      setToast("Primero crea/selecciona un club");
      setTimeout(()=>setToast(null), 2500);
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append("file", file);
      try {
        // Import background only; text/images are detected on-demand per page inside the editor
        const { data } = await api.post(`/api/import/${activeClubId}?mode=${mode}&preset=background`, fd);
        nav(`/editor/${data.project_id}`);
      } catch (e: any) {
        setToast(e?.response?.data?.detail || "No se pudo importar el PDF");
        setTimeout(()=>setToast(null), 3500);
      }
    };
    input.click();
  }

  async function generateTemplates() {
    setIsGenerating(true);
    try{
      const { data } = await api.post("/api/templates/generate", { sport, style });
      setGenOptions(data.options);
    } catch (e: any) {
      setToast(e?.response?.data?.detail || "No se pudieron generar opciones");
      setTimeout(()=>setToast(null), 3000);
    } finally {
      setIsGenerating(false);
    }
  }

  async function saveGenerated(opt: any) {
    const name = prompt("Nombre para esta plantilla:", opt.name) || opt.name;
    try {
      await api.post("/api/templates/save-generated", { name, sport, document: opt.document, layoutSignature: opt.layoutSignature });
      setToast("Plantilla guardada ✅");
      const { data: list } = await api.get("/api/templates");
      setTemplates(list);
      setGenOptions(null);
    } catch (e: any) {
      setToast(e?.response?.data?.detail || "No se pudo guardar la plantilla (¿estás logueado?)");
    } finally {
      setTimeout(()=>setToast(null), 3000);
    }
  }

  const shown = templates.filter((t) =>
    (t.name + " " + t.origin + " " + t.sport).toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="layout" style={{ position: "relative" }}>
      <div className="sidebar">
        <div className="card" style={{marginBottom:12}}>
          <h3 style={{marginTop:0}}>Tu club</h3>
          {!clubs.length ? (
            <>
              <p style={{color:"var(--muted)"}}>Crea tu club para empezar.</p>
              <button className="btn primary" onClick={createClubQuick}>Crear club</button>
            </>
          ) : (
            <>
              <div className="field">
                <label>Seleccionar club</label>
                <select value={activeClubId || ""} onChange={(e)=>setActiveClub(e.target.value)}>
                  {clubs.map(c => <option key={c.id} value={c.id}>{c.name} ({c.plan})</option>)}
                </select>
              </div>
              <div style={{display:"flex", gap:10, flexWrap:"wrap"}}>
                <button className="btn" onClick={uploadLockedLogo}>Logo portada (bloqueado)</button>
                <button
                  className="btn"
                  onClick={() =>
                    api
                      .post(`/api/clubs/${activeClubId}/dev/activate-pro`)
                      .then(loadClubs)
                      .then(() => setToast("PRO activado (dev) ✅"))
                      .catch((e) => setToast(e?.response?.data?.detail || "No se pudo activar PRO"))
                      .finally(() => setTimeout(()=>setToast(null), 2500))
                  }
                >
                  Activar PRO (dev)
                </button>
              </div>
              <p style={{color:"var(--muted)", marginBottom:0}}>
                El logo bloqueado siempre se renderiza en la portada y no se puede editar.
              </p>
            </>
          )}
        </div>

        <div className="card" style={{marginBottom:12}}>
          <h3 style={{marginTop:0}}>Crear revista</h3>
          <p style={{color:"var(--muted)", marginTop:0}}>
            Elige plantilla nativa (40 páginas) o importa un PDF.
          </p>
          <div style={{display:"flex", gap:10, flexWrap:"wrap"}}>
            <button className="btn primary" onClick={()=>importPdf("safe")}>Importar PDF (modo seguro)</button>
            <button className="btn" onClick={()=>importPdf("editable")}>Importar PDF (editable)</button>
          </div>
        </div>

        <div className="card">
          <h3 style={{marginTop:0}}>Generar plantilla (distinta)</h3>
          <p style={{color:"var(--muted)", marginTop:0}}>
            Genera 3 opciones nativas de 40 páginas. Elige una y guárdala.
          </p>
          <div className="field">
            <label>Deporte</label>
            <select value={sport} onChange={(e)=>setSport(e.target.value)}>
              <option value="football">Fútbol</option>
              <option value="basket">Basket</option>
            </select>
          </div>
          <div className="field">
            <label>Estilo (estructura)</label>
            <select value={style} onChange={(e)=>setStyle(e.target.value)}>
              <option value="minimal_premium">Minimal premium</option>
              <option value="newspaper_editorial">Editorial periódico</option>
              <option value="photographic">Fotográfico</option>
              <option value="tech_data">Tech / Datos</option>
              <option value="sponsors_first">Sponsors-first</option>
              <option value="academy_youth">Cantera / Youth</option>
            </select>
          </div>
          <button className="btn primary" disabled={isGenerating} onClick={generateTemplates}>
            {isGenerating ? "Generando..." : "Generar 3 opciones"}
          </button>
        </div>
      </div>

      <div className="main">
        <div style={{display:"flex", gap:10, alignItems:"center", marginBottom:14, flexWrap:"wrap"}}>
          <h2 style={{margin:0}}>Plantillas</h2>
          <span className="pill">Catálogo + Generadas</span>
          <input
            style={{height:40, borderRadius:14, border:"1px solid var(--border)", background:"rgba(255,255,255,.04)", color:"var(--text)", padding:"0 12px", outline:"none"}}
            value={filter}
            onChange={(e)=>setFilter(e.target.value)}
            placeholder="Buscar plantilla…"
          />
        </div>

        {genOptions && (
          <div className="card" style={{marginBottom:14}}>
            <h3 style={{marginTop:0}}>Opciones generadas</h3>
            <div className="grid">
              {genOptions.map((opt, idx) => (
                <div key={idx} className="card">
                  <div style={{fontWeight:950}}>{opt.name}</div>
                  <div style={{color:"var(--muted)", fontSize:12, marginTop:6}}>
                    Unicidad: {Math.round((opt.generator?.uniquenessScore || 0)*100)}% · similitud: {Math.round((opt.generator?.similarityToCatalogMax || 0)*100)}%
                  </div>
                  <div style={{display:"flex", gap:10, marginTop:10}}>
                    <button className="btn primary" onClick={()=>saveGenerated(opt)}>Guardar plantilla</button>
                    <button className="btn" onClick={()=>setGenOptions(null)}>Cerrar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="templates">
          {shown.map(t => (
            <div key={t.id} className="card">
              <div className="templatePreview" style={{cursor:"pointer"}} onClick={()=>setPreviewTemplate(t)}>
                <img
                  src={`${apiUrl || ""}/api/templates/${t.id}/thumbnail?page=0&size=480`}
                  alt={`Preview ${t.name}`}
                  loading="lazy"
                />
              </div>
              <div style={{display:"flex", justifyContent:"space-between", gap:10}}>
                <div style={{fontWeight:950}}>{t.name}</div>
                <span className="pill">{t.origin}</span>
              </div>
              <div style={{color:"var(--muted)", fontSize:12, marginTop:6}}>
                {t.sport} · {t.pages} páginas · A4 spreads
              </div>
              <div style={{display:"flex", gap:10, marginTop:12, flexWrap:"wrap"}}>
                <button className="btn" onClick={()=>setPreviewTemplate(t)}>Previsualizar</button>
                <button className="btn primary" onClick={()=>createProjectFromTemplate(t.id, `Revista - ${t.name}`)}>Usar plantilla</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      
      {previewTemplate && (
        <div
          onClick={() => setPreviewTemplate(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
            zIndex: 50,
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(1100px, 98vw)", maxHeight: "92vh", overflow: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 950, fontSize: 18 }}>{previewTemplate.name}</div>
                <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                  {previewTemplate.sport} · {previewTemplate.pages} páginas · A4 spreads · {previewTemplate.origin}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn" onClick={() => setPreviewTemplate(null)}>Cerrar</button>
                <button
                  className="btn primary"
                  onClick={() => createProjectFromTemplate(previewTemplate.id, `Revista - ${previewTemplate.name}`)}
                >
                  Usar esta plantilla
                </button>
              </div>
            </div>

            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
              {[0, 2, 4].map((p) => (
                <div key={p} className="card">
                  <div style={{ fontWeight: 900, marginBottom: 10, color: "var(--muted)" }}>Página {p + 1}</div>
                  <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)" }}>
                    <img
                      src={`${apiUrl || ""}/api/templates/${previewTemplate.id}/thumbnail?page=${p}&size=720`}
                      alt={`Preview page ${p + 1}`}
                      style={{ width: "100%", display: "block" }}
                      loading="lazy"
                    />
                  </div>
                </div>
              ))}
            </div>

            <p style={{ color: "var(--muted)", marginTop: 14, marginBottom: 0 }}>
              Consejo: si quieres ver otra parte, crea el proyecto y navega por páginas.
            </p>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast} />}

      {/* Build/version badge (kept inside the root to avoid JSX syntax errors) */}
      <div
        style={{
          position: "fixed",
          right: 12,
          bottom: 12,
          fontSize: 12,
          color: "rgba(233,238,249,.70)",
          background: "rgba(0,0,0,.30)",
          border: "1px solid rgba(255,255,255,.10)",
          padding: "6px 10px",
          borderRadius: 999,
          backdropFilter: "blur(10px)",
          zIndex: 60,
        }}
      >
        V10.4.7
      </div>
    </div>
  );
}

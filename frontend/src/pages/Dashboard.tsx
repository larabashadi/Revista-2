import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import { useToast } from "../store/toast";

type TemplateRow = {
  id: string;
  name: string;
  origin: string;
  sport: string;
  pages: number;
};

function getApiBase(): string {
  const env = (import.meta as any)?.env?.VITE_API_BASE as string | undefined;
  const v = (env || "").trim();
  if (v) return v.replace(/\/$/, "");
  return "";
}

function thumbUrl(id: string) {
  const base = getApiBase();
  return base ? `${base}/api/templates/${id}/thumbnail?scale=0.35` : `/api/templates/${id}/thumbnail?scale=0.35`;
}

export default function Dashboard() {
  const nav = useNavigate();
  const { token, clubs, activeClubId, setActiveClub, loadClubs, loadMe } = useAuth();
  const { showToast } = useToast();

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [q, setQ] = useState("");
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);

  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  const fileSafeRef = useRef<HTMLInputElement | null>(null);
  const fileEditRef = useRef<HTMLInputElement | null>(null);

  const activeClub = useMemo(() => {
    if (!clubs?.length) return null;
    return clubs.find((c) => c.id === activeClubId) || clubs[0] || null;
  }, [clubs, activeClubId]);

  async function loadTemplates() {
    if (!token) return;
    setLoadingTemplates(true);
    try {
      const r = await api.get<TemplateRow[]>("/api/templates");
      setTemplates(Array.isArray(r.data) ? r.data : []);
    } catch (e: any) {
      setTemplates([]);
      showToast("No se pudieron cargar las plantillas (API). Revisa backend/proxy.", "error");
    } finally {
      setLoadingTemplates(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    loadMe();
    loadClubs();
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return templates;
    return templates.filter((t) => (t.name || "").toLowerCase().includes(s) || (t.sport || "").toLowerCase().includes(s));
  }, [templates, q]);

  async function quickCreateClub() {
    try {
      const r = await api.post("/api/clubs/quick", {});
      await loadClubs();
      setActiveClub(r.data?.id);
      showToast("Club creado. Ya puedes usar plantillas o importar PDF.", "success");
    } catch (e: any) {
      showToast("No se pudo crear el club.", "error");
    }
  }

  function startImport(mode: "safe" | "editable") {
    if (!activeClub?.id) {
      showToast("Primero crea o selecciona un club.", "error");
      return;
    }
    if (mode === "safe") fileSafeRef.current?.click();
    else fileEditRef.current?.click();
  }

  async function doImport(file: File, mode: "safe" | "editable") {
    if (!activeClub?.id) return;

    setImportBusy(true);
    setImportMsg("Cargando PDF… Esto puede tardar 20–90s (según páginas).");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post(`/api/import/pdf?club_id=${activeClub.id}&mode=${mode}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 5 * 60 * 1000,
      });
      const projectId = r.data?.project_id || r.data?.id;
      if (!projectId) throw new Error("No project_id");
      showToast("PDF importado. Abriendo editor…", "success");
      nav(`/editor/${projectId}`);
    } catch (e: any) {
      showToast("No se pudo cargar el proyecto (API). Revisa backend/proxy.", "error");
    } finally {
      setImportBusy(false);
      setImportMsg("");
      // reset input value so same file can be re-picked
      if (fileSafeRef.current) fileSafeRef.current.value = "";
      if (fileEditRef.current) fileEditRef.current.value = "";
    }
  }

  async function useTemplate(tpl: TemplateRow) {
    if (!activeClub?.id) {
      showToast("Primero crea o selecciona un club.", "error");
      return;
    }
    try {
      const r = await api.post("/api/projects", { club_id: activeClub.id, template_id: tpl.id });
      const projectId = r.data?.id;
      showToast("Proyecto creado. Abriendo editor…", "success");
      nav(`/editor/${projectId}`);
    } catch (e: any) {
      showToast("No se pudo crear el proyecto (API).", "error");
    }
  }

  return (
    <div className="layout">
      {/* Overlay de carga */}
      {importBusy && (
        <div className="overlay">
          <div className="overlayCard">
            <div className="spinner" />
            <div>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Cargando PDF…</div>
              <div style={{ opacity: 0.85, fontSize: 13 }}>{importMsg || "Procesando…"}</div>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="panel">
          <div className="h2">Tu club</div>

          {!clubs?.length ? (
            <>
              <div className="muted" style={{ marginTop: 8 }}>
                Crea tu club para empezar.
              </div>
              <button className="btn btnTopPrimary" style={{ marginTop: 12 }} onClick={quickCreateClub}>
                Crear club
              </button>
            </>
          ) : (
            <>
              <label className="label" style={{ marginTop: 10 }}>
                Seleccionar club
              </label>
              <select
                className="input"
                value={activeClubId || ""}
                onChange={(e) => setActiveClub(e.target.value)}
              >
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <div className="muted" style={{ marginTop: 10 }}>
                El logo bloqueado siempre se renderiza en la portada y no se puede editar.
              </div>
            </>
          )}
        </div>

        <div className="panel" style={{ marginTop: 14 }}>
          <div className="h2">Crear revista</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Elige plantilla nativa o importa un PDF.
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn btnTopPrimary" disabled={importBusy} onClick={() => startImport("safe")}>
              {importBusy ? "Cargando…" : "Importar PDF (modo seguro)"}
            </button>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn btnTop" disabled={importBusy} onClick={() => startImport("editable")}>
              {importBusy ? "Cargando…" : "Importar PDF (editable)"}
            </button>
          </div>

          <input
            ref={fileSafeRef}
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doImport(f, "safe");
            }}
          />
          <input
            ref={fileEditRef}
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doImport(f, "editable");
            }}
          />
        </div>

        <div className="panel" style={{ marginTop: 14 }}>
          <div className="h2">Generar plantilla (distinta)</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Genera 3 opciones nativas. Elige una y guárdala.
          </div>

          {/* Nota: si ya tienes generator, puedes conectar aquí. */}
          <div className="muted" style={{ marginTop: 10 }}>
            (Opcional) Puedes usar el generador desde el panel central.
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <section className="main">
        <div className="panel">
          <div className="templatesHeader">
            <div>
              <div className="h1">Plantillas</div>
              <div className="muted">Catálogo + Generadas</div>
            </div>
            <div className="templatesSearch">
              <input
                className="input"
                placeholder="Buscar plantilla…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          {loadingTemplates ? (
            <div className="templates" style={{ marginTop: 16 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="templateCard">
                  <div className="templatePreview skeleton" />
                  <div className="templateMeta">
                    <div className="templateTitle skeleton" style={{ height: 16, width: "70%" }} />
                    <div className="muted skeleton" style={{ height: 12, width: "40%", marginTop: 10 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length ? (
            <div className="templates" style={{ marginTop: 16 }}>
              {filtered.map((tpl) => (
                <div key={tpl.id} className="templateCard">
                  <div className="templatePreview">
                    <img src={thumbUrl(tpl.id)} alt={tpl.name} />
                  </div>
                  <div className="templateMeta">
                    <div className="templateTitle">{tpl.name}</div>
                    <div className="muted" style={{ marginTop: 6 }}>
                      {tpl.sport} · {tpl.pages} páginas
                    </div>
                    <div className="row" style={{ marginTop: 12 }}>
                      <button className="btn btnTop" onClick={() => setPreviewTemplateId(tpl.id)}>
                        Previsualizar
                      </button>
                      <button className="btn btnTopPrimary" onClick={() => useTemplate(tpl)}>
                        Usar plantilla
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted" style={{ marginTop: 16 }}>
              No hay plantillas para mostrar. Si acabas de desplegar, revisa que el backend tenga el endpoint{" "}
              <code>GET /api/templates</code>.
            </div>
          )}
        </div>
      </section>

      {/* RIGHT: Preview */}
      <aside className="right">
        <div className="panel">
          <div className="h2">Previsualización</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Selecciona una plantilla y dale a “Previsualizar”.
          </div>

          {previewTemplateId ? (
            <div style={{ marginTop: 12 }}>
              <div className="templatePreviewBig">
                <img src={thumbUrl(previewTemplateId).replace("scale=0.35", "scale=0.7")} alt="preview" />
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn btnTop" onClick={() => setPreviewTemplateId(null)}>
                  Cerrar
                </button>
              </div>
            </div>
          ) : (
            <div className="muted" style={{ marginTop: 12 }}>
              Sin selección.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

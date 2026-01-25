import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import { apiUrl } from "../config";

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

  const [isImporting, setIsImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const activeClub = useMemo(
    () => clubs.find((c) => c.id === activeClubId) || null,
    [clubs, activeClubId]
  );

  const showToast = (m: string, ms = 2600) => {
    setToast(m);
    window.setTimeout(() => setToast(null), ms);
  };

  async function loadTemplates() {
    try {
      // Backend must expose GET /api/templates (list)
      const { data } = await api.get("/api/templates");
      setTemplates(Array.isArray(data) ? data : data?.templates || []);
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "No se pudieron cargar las plantillas (API)";
      showToast(detail, 3500);
      setTemplates([]);
    }
  }

  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createClubQuick() {
    const name = prompt("Nombre del club:", "Mi Club") || "Mi Club";
    try {
      const res = await api.post("/api/clubs", { name, sport: "football", language: "es" });
      setActiveClub(res.data.id);
      await loadClubs();
      showToast("Club creado ✅");
    } catch (e: any) {
      showToast(e?.response?.data?.detail || "No se pudo crear el club");
    }
  }

  async function uploadLockedLogo() {
    if (!activeClubId) {
      showToast("Primero crea/selecciona un club");
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
        await api.post(`/api/clubs/${activeClubId}/locked-logo`, fd, {
          timeout: 0,
        });
        await loadClubs();
        showToast("Logo portada actualizado ✅");
      } catch (e: any) {
        showToast(e?.response?.data?.detail || "No se pudo subir el logo", 3500);
      }
    };
    input.click();
  }

  async function createProjectFromTemplate(t: Template) {
    if (!activeClubId) {
      showToast("Primero crea/selecciona un club");
      return;
    }
    try {
      const { data } = await api.post(`/api/projects/${activeClubId}`, {
        name: `Revista - ${t.name}`,
        template_id: t.id,
      });
      nav(`/editor/${data.id}`);
    } catch (e: any) {
      showToast(e?.response?.data?.detail || "No se pudo crear el proyecto (API)", 3500);
    }
  }

  async function importPdf(mode: string) {
    if (!activeClubId) {
      showToast("Primero crea/selecciona un club");
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
        setIsImporting(true);
        setImportMsg("Cargando PDF… Esto puede tardar 20–90s (según páginas).");
        showToast("Cargando PDF…", 4000);

        // Import background only; text/images are detected on-demand per page inside the editor
        const { data } = await api.post(
          `/api/import/${activeClubId}?mode=${mode}&preset=background`,
          fd,
          {
            timeout: 0,
            maxBodyLength: Infinity as any,
            maxContentLength: Infinity as any,
          }
        );

        const pid = data?.project_id || data?.projectId || data?.id;
        if (!pid) throw new Error("Respuesta inválida: no llegó project_id");

        setImportMsg("PDF importado ✅ Abriendo editor…");
        // Pequeño delay para evitar sensación de “click y error” en Render cuando el proyecto acaba de guardarse
        await new Promise((r) => setTimeout(r, 300));
        nav(`/editor/${pid}`);
      } catch (e: any) {
        const detail =
          e?.response?.data?.detail ||
          e?.message ||
          "No se pudo importar el PDF";
        showToast(detail, 4500);
      } finally {
        setIsImporting(false);
        window.setTimeout(() => setImportMsg(null), 1200);
      }
    };
    input.click();
  }

  async function generateTemplates() {
    if (!activeClubId) {
      showToast("Primero crea/selecciona un club");
      return;
    }
    try {
      setIsGenerating(true);
      setGenOptions(null);
      const { data } = await api.post("/api/templates/generate", { sport, style });
      setGenOptions(data?.options || []);
      showToast("Opciones generadas ✅");
    } catch (e: any) {
      showToast(e?.response?.data?.detail || "No se pudieron generar opciones", 3500);
    } finally {
      setIsGenerating(false);
    }
  }

  async function saveGenerated(option: any) {
    if (!activeClubId) return;
    try {
      const { data } = await api.post("/api/templates/save-generated", {
        name: option?.name || "Plantilla generada",
        sport,
        document: option?.document,
      });
      showToast("Plantilla guardada ✅");
      setGenOptions(null);
      // recargar catálogo para mostrar las nuevas
      await loadTemplates();
      // si quieres, auto-abrir
      // await createProjectFromTemplate(data);
    } catch (e: any) {
      showToast(e?.response?.data?.detail || "No se pudo guardar la plantilla", 3500);
    }
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => (t.name || "").toLowerCase().includes(q));
  }, [templates, filter]);

  return (
    <div className="page">
      {toast ? <Toast msg={toast} /> : null}

      {/* Import overlay */}
      {isImporting && (
        <div className="overlay">
          <div className="overlayCard">
            <div className="overlayTitle">Cargando PDF…</div>
            <div className="overlayText">
              {importMsg ||
                "Procesando el PDF y preparando las páginas. No cierres esta pestaña."}
            </div>
            <div className="overlayHint">
              Si es un PDF grande, puede tardar. Cuando termine, se abrirá el editor.
            </div>
          </div>
        </div>
      )}

      <div className="grid">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Tu club</h3>

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <button className="btn" onClick={createClubQuick}>
              Crear club rápido
            </button>

            <div className="field" style={{ minWidth: 260 }}>
              <label>Seleccionar club</label>
              <select
                value={activeClubId || ""}
                onChange={(e) => setActiveClub(e.target.value)}
              >
                <option value="" disabled>
                  -- selecciona --
                </option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.plan || "free"})
                  </option>
                ))}
              </select>
            </div>

            <button className="btn" onClick={uploadLockedLogo} disabled={!activeClubId}>
              Logo portada (bloqueado)
            </button>

            <button
              className="btn"
              onClick={() => showToast("PRO activado (dev)")}
              title="Modo PRO en desarrollo"
            >
              Activar PRO (dev)
            </button>
          </div>

          <p style={{ color: "var(--muted)" }}>
            El logo bloqueado siempre se renderiza en la portada y no se puede editar.
          </p>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Crear revista</h3>
          <p style={{ color: "var(--muted)", marginTop: 0 }}>
            Elige plantilla nativa (40 páginas) o importa un PDF.
          </p>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <button className="btn primary" onClick={() => importPdf("safe")} disabled={isImporting}>
              {isImporting ? "Cargando PDF…" : "Importar PDF (modo seguro)"}
            </button>
            <button className="btn" onClick={() => importPdf("editable")} disabled={isImporting}>
              {isImporting ? "Cargando PDF…" : "Importar PDF (editable)"}
            </button>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Generar plantilla (distinta)</h3>
          <p style={{ color: "var(--muted)", marginTop: 0 }}>
            Genera 3 opciones nativas de 40 páginas. Elige una y guárdala.
          </p>

          <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "end" }}>
            <div className="field">
              <label>Deporte</label>
              <select value={sport} onChange={(e) => setSport(e.target.value)}>
                <option value="football">Fútbol</option>
                <option value="basket">Basket</option>
              </select>
            </div>

            <div className="field">
              <label>Estilo (estructura)</label>
              <select value={style} onChange={(e) => setStyle(e.target.value)}>
                <option value="minimal_premium">Minimal premium</option>
                <option value="bold_modern">Bold modern</option>
                <option value="classic_mag">Classic magazine</option>
              </select>
            </div>

            <button className="btn primary" onClick={generateTemplates} disabled={isGenerating}>
              {isGenerating ? "Generando…" : "Generar 3 opciones"}
            </button>
          </div>

          {genOptions?.length ? (
            <div style={{ marginTop: 12 }} className="templatesGrid">
              {genOptions.map((opt, idx) => (
                <div key={idx} className="templateCard">
                  <div className="templateTitle">{opt?.name || `Opción ${idx + 1}`}</div>
                  <div className="templateMeta">Generada · {sport}</div>
                  <div className="templateActions">
                    <button className="btn" onClick={() => saveGenerated(opt)}>
                      Guardar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0 }}>Plantillas</h2>
              <div style={{ color: "var(--muted)" }}>Catálogo + Generadas</div>
            </div>

            <div className="field" style={{ minWidth: 280 }}>
              <label>Buscar plantilla</label>
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar plantilla…" />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div style={{ marginTop: 12, color: "var(--muted)" }}>
              No hay plantillas para mostrar. Si acabas de desplegar, revisa que el backend tenga el endpoint{" "}
              <code>GET /api/templates</code>.
            </div>
          ) : (
            <div className="templatesGrid" style={{ marginTop: 12 }}>
              {filtered.map((t) => (
                <div key={t.id} className="templateCard">
                  <div
                    className="templatePreview"
                    style={{ cursor: "pointer" }}
                    onClick={() => setPreviewTemplate(t)}
                    title="Ver preview"
                  >
                    <img
                      src={apiUrl(`/api/templates/${t.id}/thumbnail?page=0&size=560`)}
                      alt={`Preview ${t.name}`}
                      loading="lazy"
                    />
                  </div>

                  <div className="templateBody">
                    <div className="templateTitle">{t.name}</div>
                    <div className="templateMeta">
                      {t.origin} · {t.sport} · {t.pages} páginas
                    </div>

                    <div className="templateActions">
                      <button className="btn primary" onClick={() => createProjectFromTemplate(t)}>
                        Usar esta plantilla
                      </button>
                      <button className="btn" onClick={() => setPreviewTemplate(t)}>
                        Previsualizar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Simple preview modal */}
      {previewTemplate ? (
        <div className="modalBackdrop" onClick={() => setPreviewTemplate(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 800 }}>{previewTemplate.name}</div>
                <div style={{ color: "var(--muted)" }}>
                  {previewTemplate.origin} · {previewTemplate.sport} · {previewTemplate.pages} páginas
                </div>
              </div>
              <button className="btn" onClick={() => setPreviewTemplate(null)}>
                Cerrar
              </button>
            </div>

            <div className="modalPreview">
              <img
                src={apiUrl(`/api/templates/${previewTemplate.id}/thumbnail?page=0&size=900`)}
                alt="preview"
              />
            </div>

            <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
              <button className="btn primary" onClick={() => createProjectFromTemplate(previewTemplate)}>
                Usar esta plantilla
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { apiUrl } from "../lib/api";
import { useAuth } from "../store/auth";

type TemplateOut = {
  id: string;
  name: string;
  origin: string;
  sport?: string | null;
  pages: number;
};

export default function Dashboard() {
  const nav = useNavigate();
  const { clubs, activeClubId, setActiveClub, loadClubs } = useAuth();

  const [templates, setTemplates] = useState<TemplateOut[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingPdfMsg, setLoadingPdfMsg] = useState<string>("");

  const activeClub = useMemo(
    () => clubs.find((c) => String(c.id) === String(activeClubId || "")) || null,
    [clubs, activeClubId]
  );

  const allowedTemplateIds = useMemo(() => {
    const raw = activeClub?.allowed_template_ids || "";
    const set = new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
    return set;
  }, [activeClub?.allowed_template_ids]);

  const templatesFiltered = useMemo(() => {
    const base = templates.filter((t) => {
      if (activeClub?.templates_locked && allowedTemplateIds.size > 0) {
        return allowedTemplateIds.has(t.id);
      }
      return true;
    });

    const qq = q.trim().toLowerCase();
    if (!qq) return base;

    return base.filter((t) => {
      const sport = (t.sport || "").toLowerCase();
      return (
        t.name.toLowerCase().includes(qq) ||
        t.origin.toLowerCase().includes(qq) ||
        sport.includes(qq)
      );
    });
  }, [templates, q, activeClub?.templates_locked, allowedTemplateIds]);

  async function fetchTemplates() {
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const res = await api.get("/api/templates");
      setTemplates((res.data as TemplateOut[]) || []);
    } catch (e: any) {
      setTemplates([]);
      setTemplatesError("No se pudieron cargar las plantillas (API).");
    } finally {
      setTemplatesLoading(false);
    }
  }

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClubId]);

  async function createClubQuick() {
    const name = prompt("Nombre del club:");
    if (!name) return;
    try {
      await api.post("/api/clubs", { name });
      await loadClubs();
    } catch (e) {
      alert("No se pudo crear el club.");
    }
  }

  async function useTemplate() {
    if (!activeClubId || !selectedTemplateId) {
      alert("Selecciona un club y una plantilla.");
      return;
    }
    try {
      const res = await api.post(`/api/projects/${activeClubId}`, {
        name: "Revista",
        template_id: selectedTemplateId,
      });
      const projectId = (res.data as any)?.id;
      if (!projectId) throw new Error("No project id");
      nav(`/editor/${projectId}`);
    } catch (e) {
      alert("No se pudo crear el proyecto desde plantilla (API).");
    }
  }

  async function importPdf(mode: "safe" | "editable") {
    if (!activeClubId) {
      alert("Selecciona un club primero.");
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      setLoadingPdf(true);
      setLoadingPdfMsg(
        "Cargando PDF… Esto puede tardar 20–90s (según páginas). Al terminar se abrirá el editor."
      );

      try {
        const fd = new FormData();
        fd.append("file", file);

        const res = await api.post(`/api/import/${activeClubId}?mode=${mode}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 0,
        });

        const projectId = (res.data as any)?.project_id;
        if (!projectId) throw new Error("No project_id");
        nav(`/editor/${projectId}`);
      } catch (e: any) {
        alert(
          `No se pudo cargar el proyecto (API). Revisa backend/proxy.\n${e?.message || ""}`
        );
      } finally {
        setLoadingPdf(false);
        setLoadingPdfMsg("");
      }
    };
    input.click();
  }

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  return (
    <div className="container">
      {loadingPdf && (
        <div
          style={{
            padding: "10px 14px",
            marginBottom: 12,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(0,0,0,0.25)",
          }}
        >
          <div style={{ fontWeight: 800 }}>Cargando PDF…</div>
          <div style={{ opacity: 0.9 }}>{loadingPdfMsg}</div>
        </div>
      )}

      <div className="grid2">
        <div className="panel">
          <h2>Tu club</h2>

          <div className="row">
            <button className="btn" onClick={createClubQuick}>
              Crear club rápido
            </button>
          </div>

          <div className="field">
            <label>Seleccionar club</label>
            <select
              value={activeClubId || ""}
              onChange={(e) => setActiveClub(e.target.value || null)}
            >
              <option value="" disabled>
                —
              </option>
              {clubs.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name} {c.plan ? `(${c.plan})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 10, opacity: 0.9 }}>
            {activeClub?.locked_logo_asset_id
              ? "Logo bloqueado listo para portada."
              : "Aún no hay logo bloqueado para portada."}
          </div>

          <hr className="sep" />

          <h2>Crear revista</h2>
          <div style={{ opacity: 0.9 }}>
            Elige plantilla nativa o importa un PDF.
          </div>

          <div className="row" style={{ marginTop: 10 }}>
            <button
              className="btn primary"
              disabled={loadingPdf}
              onClick={() => importPdf("safe")}
            >
              {loadingPdf ? "Cargando PDF…" : "Importar PDF (modo seguro)"}
            </button>
            <button
              className="btn"
              disabled={loadingPdf}
              onClick={() => importPdf("editable")}
            >
              {loadingPdf ? "Cargando PDF…" : "Importar PDF (editable)"}
            </button>
          </div>
        </div>

        <div className="panel">
          <h2>Plantillas</h2>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ opacity: 0.85 }}>Catálogo + Generadas</div>
            <input
              placeholder="Buscar plantilla..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ flex: 1 }}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            {templatesLoading && <div>Cargando plantillas…</div>}
            {!templatesLoading && templatesError && (
              <div style={{ color: "#ffb4b4" }}>{templatesError}</div>
            )}
            {!templatesLoading && !templatesError && templatesFiltered.length === 0 && (
              <div style={{ opacity: 0.9 }}>
                No hay plantillas para mostrar. Revisa backend: GET /api/templates
              </div>
            )}
          </div>

          <div className="cards" style={{ marginTop: 12 }}>
            {templatesFiltered.map((t) => {
              const thumb = apiUrl(`/api/templates/${t.id}/thumbnail`);
              return (
                <div
                  key={t.id}
                  className={
                    "card " + (t.id === selectedTemplateId ? "selected" : "")
                  }
                  onClick={() => setSelectedTemplateId(t.id)}
                >
                  <div className="thumb">
                    <img
                      src={thumb}
                      alt={t.name}
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display =
                          "none";
                      }}
                    />
                  </div>
                  <div className="cardTitle">{t.name}</div>
                  <div className="meta">
                    {(t.sport || "—") + " · " + t.pages + " páginas · " + t.origin}
                  </div>
                  <div className="row" style={{ marginTop: 10 }}>
                    <button
                      className="btn"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setPreviewUrl(apiUrl(`/api/templates/${t.id}/preview_pdf`));
                      }}
                    >
                      Previsualizar
                    </button>
                    <button
                      className="btn primary"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setSelectedTemplateId(t.id);
                        setTimeout(useTemplate, 0);
                      }}
                    >
                      Usar plantilla
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <hr className="sep" />

          <h2>Previsualización</h2>
          <div style={{ opacity: 0.9 }}>
            Selecciona una plantilla y dale a “Previsualizar”.
          </div>

          <div style={{ marginTop: 10, opacity: 0.9 }}>
            {selectedTemplate ? `Seleccionada: ${selectedTemplate.name}` : "Sin selección."}
          </div>
        </div>
      </div>

      {previewUrl && (
        <div className="modalBackdrop" onClick={() => setPreviewUrl(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div style={{ fontWeight: 800 }}>Previsualización</div>
              <button className="btn" onClick={() => setPreviewUrl(null)}>
                Cerrar
              </button>
            </div>
            <div style={{ height: "75vh", marginTop: 10 }}>
              <iframe
                title="preview"
                src={previewUrl}
                style={{ width: "100%", height: "100%", border: "none" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

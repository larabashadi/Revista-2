import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, apiUrl } from "../lib/api";
import { useAuth } from "../store/auth";

type Template = {
  id: string;
  name: string;
  origin: string;
  sport?: string | null;
  pages?: number | null;
};

export default function Dashboard() {
  const nav = useNavigate();
  const { clubs, activeClubId, setActiveClub, loadClubs } = useAuth();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [selected, setSelected] = useState<Template | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const activeClub = useMemo(() => {
    return clubs.find((c) => String(c.id) === String(activeClubId)) ?? null;
  }, [clubs, activeClubId]);

  useEffect(() => {
    loadClubs().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchTemplates() {
    setLoadingTemplates(true);
    setTemplatesError(null);
    try {
      const res = await api.get("/api/templates");
      const list = (res.data as Template[]) || [];
      setTemplates(list);
      if (!selected && list.length > 0) setSelected(list[0]);
    } catch (e: any) {
      setTemplates([]);
      setTemplatesError("No se pudieron cargar las plantillas (API)");
    } finally {
      setLoadingTemplates(false);
    }
  }

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) {
      setPreviewUrl(null);
      return;
    }
    // Preview PDF desde el BACKEND real
    const url = `${apiUrl}/api/templates/${selected.id}/preview?ts=${Date.now()}`;
    setPreviewUrl(url);
  }, [selected]);

  async function handleUseTemplate() {
    if (!activeClubId || !selected) return;
    try {
      setImporting(true);
      setImportMsg("Creando proyecto desde plantilla…");
      const res = await api.post(`/api/projects/from-template/${activeClubId}`, {
        template_id: selected.id,
      });
      const projectId = res.data?.id;
      if (!projectId) throw new Error("No project id");
      nav(`/editor/${projectId}`);
    } catch (e) {
      setImportMsg("Error creando el proyecto (API). Revisa backend/proxy.");
    } finally {
      setImporting(false);
      setTimeout(() => setImportMsg(null), 3000);
    }
  }

  async function handleImportPdf(mode: "safe" | "editable", file: File) {
    if (!activeClubId) return;

    const fd = new FormData();
    fd.append("file", file);

    try {
      setImporting(true);
      setImportMsg(
        "Cargando PDF… Esto puede tardar 20–90s (según páginas). Cuando termine, se abrirá el editor."
      );

      const res = await api.post(`/api/import/${activeClubId}?mode=${mode}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const projectId = res.data?.project_id || res.data?.id;
      if (!projectId) throw new Error("No project id");
      nav(`/editor/${projectId}`);
    } catch (e: any) {
      setImportMsg(
        `No se pudo cargar el proyecto (API). Revisa backend/proxy.`
      );
    } finally {
      setImporting(false);
      // no lo quites instantáneo porque si tarda, el usuario cree que “se colgó”
      setTimeout(() => setImportMsg(null), 6000);
    }
  }

  return (
    <div className="appShell">
      <header className="topbar">
        <div className="brand">
          <div className="logoDot" />
          <div className="brandText">
            <div className="brandTitle">Sports Magazine SaaS</div>
            <div className="brandSub">Editor de revistas</div>
          </div>
          <span className="pill">v10.4.7</span>
        </div>

        <div className="topbarRight">
          <button className="btn" onClick={() => nav("/dashboard")}>
            Dashboard
          </button>
          <button className="btn danger" onClick={() => nav("/logout")}>
            Salir
          </button>
        </div>
      </header>

      {importMsg ? <div className="banner">{importMsg}</div> : null}

      <main className="dashboardGrid">
        {/* Left panel */}
        <section className="panel">
          <h2 className="panelTitle">Tu club</h2>

          <div className="field">
            <label>Seleccionar club</label>
            <select
              value={activeClubId ?? ""}
              onChange={(e) => setActiveClub(e.target.value || null)}
              disabled={importing}
            >
              {clubs.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="help">
            {activeClub?.locked_logo_asset_id
              ? "Logo portada (bloqueado) disponible."
              : "Aún no hay logo bloqueado para portada."}
          </div>

          <hr className="sep" />

          <h2 className="panelTitle">Crear revista</h2>
          <div className="help">Elige plantilla nativa o importa un PDF.</div>

          <div className="row">
            <label className="btn">
              {importing ? "Cargando PDF…" : "Importar PDF (modo seguro)"}
              <input
                type="file"
                accept="application/pdf"
                style={{ display: "none" }}
                disabled={importing}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportPdf("safe", f);
                  e.currentTarget.value = "";
                }}
              />
            </label>

            <label className="btn">
              {importing ? "Cargando PDF…" : "Importar PDF (editable)"}
              <input
                type="file"
                accept="application/pdf"
                style={{ display: "none" }}
                disabled={importing}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportPdf("editable", f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </section>

        {/* Center preview */}
        <section className="panel panelPreview">
          <div className="panelHeader">
            <h2 className="panelTitle">Previsualización</h2>
            <button className="btn primary" disabled={!selected || importing} onClick={handleUseTemplate}>
              Usar plantilla
            </button>
          </div>

          {!selected ? (
            <div className="help">Selecciona una plantilla para previsualizar.</div>
          ) : previewUrl ? (
            <iframe
              title="preview"
              className="previewFrame"
              src={previewUrl}
            />
          ) : (
            <div className="help">Cargando previsualización…</div>
          )}
        </section>

        {/* Right templates */}
        <section className="panel">
          <h2 className="panelTitle">Plantillas</h2>
          <div className="help">Catálogo + Generadas</div>

          {loadingTemplates ? (
            <div className="help">Cargando plantillas…</div>
          ) : templatesError ? (
            <div className="help">{templatesError}</div>
          ) : templates.length === 0 ? (
            <div className="help">
              No hay plantillas para mostrar. Revisa backend: GET /api/templates
            </div>
          ) : (
            <div className="templateGrid">
              {templates.map((t) => {
                const thumb = `${apiUrl}/api/templates/${t.id}/thumbnail?ts=${Date.now()}`;
                const isActive = selected?.id === t.id;

                return (
                  <button
                    key={t.id}
                    className={`templateCard ${isActive ? "active" : ""}`}
                    onClick={() => setSelected(t)}
                    disabled={importing}
                    title={t.name}
                  >
                    <div className="templateThumb">
                      <img src={thumb} alt={t.name} loading="lazy" />
                    </div>
                    <div className="templateMeta">
                      <div className="templateName">{t.name}</div>
                      <div className="templateSub">
                        {t.sport ?? "sport"} · {t.pages ?? 40} páginas · {t.origin}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

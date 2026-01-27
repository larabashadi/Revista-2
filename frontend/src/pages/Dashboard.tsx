import { useEffect, useMemo, useState } from "react";
import { api, apiUrl, getApiErrorMessage } from "../lib/api";
import { useAuth } from "../store/auth";

type Template = {
  id: string;
  name: string;
  sport: string;
  pages: number;
  format: string;
  thumbnail_url?: string | null;
};

export default function Dashboard() {
  const clubs = useAuth((s) => s.clubs);
  const loadClubs = useAuth((s) => s.loadClubs);
  const activeClubId = useAuth((s) => s.activeClubId);
  const setActiveClub = useAuth((s) => s.setActiveClub);
  const logout = useAuth((s) => s.logout);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    loadClubs().catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingTemplates(true);
      setTemplatesError(null);
      try {
        const res = await api.get("/api/templates");
        if (!cancelled) setTemplates(res.data || []);
      } catch (e: any) {
        if (!cancelled) setTemplatesError(`No se pudieron cargar las plantillas (API): ${getApiErrorMessage(e)}`);
      } finally {
        if (!cancelled) setLoadingTemplates(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => `${t.name} ${t.sport} ${t.format}`.toLowerCase().includes(q));
  }, [templates, query]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  async function useTemplate(tplId: string) {
    if (!activeClubId) {
      alert("Selecciona un club primero.");
      return;
    }
    try {
      const res = await api.post(`/api/projects/from_template`, {
        club_id: activeClubId,
        template_id: tplId,
      });
      const projectId = res.data?.project_id;
      if (!projectId) throw new Error("No project_id");
      window.location.href = `/editor?project=${encodeURIComponent(projectId)}`;
    } catch (e: any) {
      alert(`Error creando proyecto: ${getApiErrorMessage(e)}`);
    }
  }

  async function importPdf(editable: boolean) {
    setImportError(null);
    setImporting(true);
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/pdf";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          setImporting(false);
          return;
        }
        if (!activeClubId) {
          setImportError("Selecciona un club primero.");
          setImporting(false);
          return;
        }
        const fd = new FormData();
        fd.append("file", file);
        fd.append("club_id", activeClubId);
        fd.append("editable", editable ? "true" : "false");

        try {
          const res = await api.post(`/api/import_pdf`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          const projectId = res.data?.project_id;
          if (!projectId) throw new Error("No project_id");
          window.location.href = `/editor?project=${encodeURIComponent(projectId)}`;
        } catch (e: any) {
          setImportError(`No se pudo cargar el proyecto (API): ${getApiErrorMessage(e)}`);
        } finally {
          setImporting(false);
        }
      };
      input.click();
    } catch (e: any) {
      setImportError(getApiErrorMessage(e));
      setImporting(false);
    }
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <div className="logo">S</div>
          <div>
            <div className="title">Sports Magazine SaaS</div>
            <div className="subtitle">Editor de revistas</div>
          </div>
        </div>

        <div className="top-actions">
          <a className="btn" href="/dashboard">Dashboard</a>
          <button className="btn danger" onClick={() => logout()}>Salir</button>
        </div>
      </div>

      {importing && (
        <div className="banner">
          <b>Cargando PDF…</b> Esto puede tardar 20–90s según páginas. Cuando termine, se abrirá el editor.
        </div>
      )}

      <div className="layout">
        {/* LEFT */}
        <div className="panel">
          <h2>Tu club</h2>
          <div className="field">
            <label>Seleccionar club</label>
            <select
              value={activeClubId || ""}
              onChange={(e) => setActiveClub(e.target.value || null)}
            >
              <option value="">—</option>
              {clubs.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sep" />

          <h2>Crear revista</h2>
          <div className="hint">Elige plantilla nativa o importa un PDF.</div>

          <div className="row">
            <button className="btn primary" disabled={importing} onClick={() => importPdf(false)}>
              {importing ? "Cargando PDF…" : "Importar PDF (modo seguro)"}
            </button>
            <button className="btn" disabled={importing} onClick={() => importPdf(true)}>
              {importing ? "Cargando PDF…" : "Importar PDF (editable)"}
            </button>
          </div>

          {importError && <div className="error">{importError}</div>}
        </div>

        {/* CENTER */}
        <div className="panel center">
          <div className="panel-head">
            <h2>Plantillas</h2>
            <div className="muted">Catálogo + Generadas</div>
          </div>

          <input
            className="search"
            placeholder="Buscar plantilla…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {loadingTemplates && <div className="hint">Cargando plantillas…</div>}
          {templatesError && <div className="error">{templatesError}</div>}

          {!loadingTemplates && !templatesError && filtered.length === 0 && (
            <div className="hint">
              No hay plantillas para mostrar. Revisa backend: <code>GET /api/templates</code>.
            </div>
          )}

          <div className="grid">
            {filtered.map((t) => {
              const thumb =
                t.thumbnail_url?.startsWith("http")
                  ? t.thumbnail_url
                  : t.thumbnail_url
                    ? `${apiUrl}${t.thumbnail_url}`
                    : null;

              return (
                <div
                  key={t.id}
                  className={`card ${selectedTemplateId === t.id ? "selected" : ""}`}
                  onClick={() => setSelectedTemplateId(t.id)}
                >
                  <div className="thumb">
                    {thumb ? <img src={thumb} alt={t.name} /> : <div className="thumb-ph" />}
                  </div>
                  <div className="card-body">
                    <div className="card-title">{t.name}</div>
                    <div className="card-meta">
                      {t.sport} · {t.pages} páginas · {t.format}
                    </div>

                    <div className="row">
                      <button className="btn" onClick={(e) => { e.stopPropagation(); setSelectedTemplateId(t.id); }}>
                        Previsualizar
                      </button>
                      <button className="btn primary" onClick={(e) => { e.stopPropagation(); useTemplate(t.id); }}>
                        Usar plantilla
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT */}
        <div className="panel">
          <h2>Previsualización</h2>
          <div className="hint">Selecciona una plantilla y dale a “Previsualizar”.</div>

          {!selectedTemplate && <div className="hint">Sin selección.</div>}

          {selectedTemplate && (
            <div>
              <div className="card-title">{selectedTemplate.name}</div>
              <div className="card-meta">
                {selectedTemplate.sport} · {selectedTemplate.pages} páginas · {selectedTemplate.format}
              </div>
              <div className="sep" />
              <button className="btn primary" onClick={() => useTemplate(selectedTemplate.id)}>
                Crear revista con esta plantilla
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

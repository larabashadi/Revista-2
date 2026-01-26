import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, apiUrl } from "../lib/api";
import { useAuth } from "../store/auth";

type Template = {
  id: string;
  title: string;
  sport: string;
  style: string;// frontend/src/pages/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { apiUrl } from "../lib/api";
import { useAuth } from "../store/auth";

type TemplateRow = {
  id: string;
  name: string;
  origin: string;
  sport: string;
  pages: number;
};

export default function Dashboard() {
  const nav = useNavigate();
  const { token, clubs, loadClubs, activeClubId, setActiveClubId } = useAuth();

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<TemplateRow | null>(null);

  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfMsg, setPdfMsg] = useState("");

  const clubId = activeClubId || clubs?.[0]?.id || "";

  useEffect(() => {
    if (!token) nav("/login");
  }, [token]);

  useEffect(() => {
    loadClubs();
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return templates;
    return templates.filter((t) =>
      `${t.name} ${t.origin} ${t.sport}`.toLowerCase().includes(qq)
    );
  }, [templates, q]);

  const loadTemplates = async () => {
    try {
      setTemplatesLoading(true);
      setTemplatesError(null);
      const res = await api.get("/api/templates");
      setTemplates(res.data || []);
    } catch (e: any) {
      setTemplatesError("No se pudieron cargar las plantillas (API)");
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleUseTemplate = async (tpl: TemplateRow) => {
    if (!clubId) {
      alert("Primero selecciona o crea un club.");
      return;
    }
    try {
      const res = await api.post("/api/projects", {
        club_id: clubId,
        name: tpl.name,
        template_id: tpl.id,
      });
      nav(`/editor/${res.data.id}`);
    } catch (e) {
      alert("No se pudo crear el proyecto con la plantilla.");
    }
  };

  const handleImportPdf = async (mode: "safe" | "pro") => {
    if (!clubId) {
      alert("Primero selecciona o crea un club.");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const form = new FormData();
      form.append("file", file);
      form.append("mode", mode);

      try {
        setPdfLoading(true);
        setPdfMsg("Cargando PDF... Esto puede tardar 20–90s según páginas.");

        const res = await api.post(`/api/import/${clubId}`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        nav(`/editor/${res.data.project_id}`);
      } catch (e: any) {
        alert(`Error importando PDF: ${e?.response?.status || ""}`);
      } finally {
        setPdfLoading(false);
        setPdfMsg("");
      }
    };
    input.click();
  };

  return (
    <div>
      {pdfLoading && (
        <div style={{ padding: 12, background: "rgba(0,0,0,.35)" }}>
          <b>{pdfMsg}</b>
        </div>
      )}

      <div className="layout">
        {/* LEFT */}
        <div className="sidebar left">
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Tu club</div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                Seleccionar club
              </div>

              <select
                value={clubId}
                onChange={(e) => setActiveClubId(e.target.value)}
                style={{ width: "100%" }}
              >
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.plan})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Crear revista</div>

            <button
              className="btn primary"
              disabled={pdfLoading}
              onClick={() => handleImportPdf("safe")}
            >
              {pdfLoading ? "Cargando PDF..." : "Importar PDF (modo seguro)"}
            </button>

            <button
              className="btn"
              disabled={pdfLoading}
              onClick={() => handleImportPdf("pro")}
              style={{ marginTop: 8 }}
            >
              {pdfLoading ? "Cargando PDF..." : "Importar PDF (editable)"}
            </button>
          </div>
        </div>

        {/* CENTER */}
        <div className="main">
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 900 }}>Plantillas</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  Catálogo + Generadas
                </div>
              </div>

              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar plantilla..."
                style={{ width: 220 }}
              />
            </div>

            {templatesLoading && <div>Cargando plantillas...</div>}
            {templatesError && <div style={{ color: "#ff6" }}>{templatesError}</div>}

            <div className="templates" style={{ marginTop: 12 }}>
              {filtered.map((t) => (
                <div className="card" key={t.id}>
                  <div className="templatePreview">
                    <img
                      loading="lazy"
                      decoding="async"
                      src={apiUrl(`/api/templates/${t.id}/thumbnail?size=420&page=0`)}
                      alt={t.name}
                    />
                  </div>
                  <div style={{ fontWeight: 800 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {t.sport} · {t.pages} páginas · {t.origin}
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button className="btn" onClick={() => setSelected(t)}>
                      Previsualizar
                    </button>
                    <button className="btn primary" onClick={() => handleUseTemplate(t)}>
                      Usar plantilla
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="sidebar right">
          <div className="card">
            <div style={{ fontWeight: 900 }}>Previsualización</div>
            {!selected ? (
              <div style={{ marginTop: 8, color: "var(--muted)" }}>
                Selecciona una plantilla y dale “Previsualizar”.
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                <div className="templatePreview" style={{ height: 240 }}>
                  <img
                    src={apiUrl(`/api/templates/${selected.id}/thumbnail?size=720&page=0`)}
                    alt={selected.name}
                  />
                </div>
                <div style={{ fontWeight: 900 }}>{selected.name}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

  pages: number;
  format: string;
  source: string;
  thumbnail_url?: string | null;
};

export default function Dashboard() {
  const nav = useNavigate();
  const { clubs, activeClubId, setActiveClub, loadClubs } = useAuth();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<Template | null>(null);

  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const activeClub = useMemo(
    () => clubs.find((c) => String(c.id) === String(activeClubId)) || null,
    [clubs, activeClubId]
  );

  async function fetchTemplates() {
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const res = await api.get("/api/templates");
      setTemplates(res.data || []);
    } catch (e: any) {
      setTemplatesError("No se pudieron cargar las plantillas (API)");
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }

  useEffect(() => {
    // refresh clubs and templates on entry
    loadClubs().catch(() => {});
    fetchTemplates().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => {
      return (
        t.title.toLowerCase().includes(q) ||
        t.sport.toLowerCase().includes(q) ||
        t.style.toLowerCase().includes(q)
      );
    });
  }, [templates, query]);

  async function importPdf(editable: boolean) {
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

      setImporting(true);
      setImportMsg(
        "Cargando PDF... Esto puede tardar 20–90s (según páginas). Cuando termine, se abrirá el editor."
      );

      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("club_id", String(activeClubId));
        fd.append("editable", editable ? "1" : "0");

        // backend: /api/projects/import
        const res = await api.post("/api/projects/import", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        const projectId = res.data?.project_id;
        if (!projectId) throw new Error("Import no devolvió project_id");

        nav(`/editor/${projectId}`);
      } catch (e: any) {
        const code = e?.response?.status ? ` [${e.response.status}]` : "";
        alert(`No se pudo cargar el proyecto (API)${code}. Revisa backend/proxy.`);
      } finally {
        setImporting(false);
        setImportMsg(null);
      }
    };
    input.click();
  }

  async function useTemplate(t: Template) {
    if (!activeClubId) {
      alert("Selecciona un club primero.");
      return;
    }
    try {
      const res = await api.post("/api/projects/from-template", {
        club_id: String(activeClubId),
        template_id: t.id,
      });
      const projectId = res.data?.project_id;
      if (!projectId) throw new Error("No project_id");
      nav(`/editor/${projectId}`);
    } catch (e) {
      alert("No se pudo crear el proyecto desde plantilla (API).");
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)]">
      {importMsg && (
        <div className="px-6 pt-4 text-sm text-white/90">
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            {importMsg}
          </div>
        </div>
      )}

      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Tu club</div>
            <div className="mt-3">
              <div className="text-xs text-white/60 mb-1">Seleccionar club</div>
              <select
                className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-white"
                value={activeClubId || ""}
                onChange={(e) => setActiveClub(String(e.target.value))}
              >
                {clubs.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name} {c.plan ? `(${c.plan})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 text-sm text-white/70">
              {activeClub?.locked_logo_asset_id
                ? "Logo portada (bloqueado) configurado."
                : "Aún no hay logo bloqueado para portada."}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Crear revista</div>
            <div className="text-sm text-white/70 mt-1">
              Elige plantilla nativa o importa un PDF.
            </div>

            <div className="mt-4 flex gap-3 flex-wrap">
              <button
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/10"
                disabled={importing}
                onClick={() => importPdf(false)}
              >
                {importing ? "Cargando PDF..." : "Importar PDF (modo seguro)"}
              </button>

              <button
                className="px-4 py-2 rounded-xl bg-purple-600/80 hover:bg-purple-600 text-white border border-white/10"
                disabled={importing}
                onClick={() => importPdf(true)}
              >
                {importing ? "Cargando PDF..." : "Importar PDF (editable)"}
              </button>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <div className="text-2xl font-semibold text-white">Plantillas</div>
                <div className="text-sm text-white/70">Catálogo + Generadas</div>
              </div>
              <input
                className="w-full sm:w-[360px] rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-white placeholder:text-white/30"
                placeholder="Buscar plantilla..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {templatesLoading && (
              <div className="mt-4 text-white/70 text-sm">Cargando plantillas...</div>
            )}
            {templatesError && (
              <div className="mt-4 text-red-300 text-sm">{templatesError}</div>
            )}

            {!templatesLoading && !templatesError && filtered.length === 0 && (
              <div className="mt-4 text-white/60 text-sm">
                No hay plantillas para mostrar. Revisa backend: <code>GET /api/templates</code>
              </div>
            )}

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((t) => {
                const thumb =
                  t.thumbnail_url && /^https?:\/\//i.test(t.thumbnail_url)
                    ? t.thumbnail_url
                    : apiUrl(`/api/templates/${t.id}/thumbnail`);

                return (
                  <div
                    key={t.id}
                    className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden"
                  >
                    <div className="aspect-[4/3] bg-black/30">
                      <img
                        src={thumb}
                        alt={t.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.opacity = "0.2";
                        }}
                      />
                    </div>
                    <div className="p-4">
                      <div className="text-white font-semibold">{t.title}</div>
                      <div className="text-xs text-white/60 mt-1">
                        {t.sport} · {t.pages} páginas · {t.format} · {t.source}
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button
                          className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/10 text-sm"
                          onClick={() => setPreview(t)}
                        >
                          Previsualizar
                        </button>
                        <button
                          className="px-3 py-2 rounded-xl bg-purple-600/80 hover:bg-purple-600 text-white border border-white/10 text-sm"
                          onClick={() => useTemplate(t)}
                        >
                          Usar plantilla
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Previsualización</div>
            <div className="text-sm text-white/70 mt-1">
              Selecciona una plantilla y dale a “Previsualizar”.
            </div>

            {!preview ? (
              <div className="mt-4 text-white/60 text-sm">Sin selección.</div>
            ) : (
              <div className="mt-4">
                <div className="text-white font-semibold">{preview.title}</div>
                <div className="text-xs text-white/60 mt-1">
                  {preview.sport} · {preview.pages} páginas · {preview.format}
                </div>

                <div className="mt-3 aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 bg-black/30">
                  <img
                    src={apiUrl(`/api/templates/${preview.id}/thumbnail`)}
                    alt={preview.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

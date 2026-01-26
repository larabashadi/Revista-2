import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { apiUrl } from "../lib/api";
import { useAuth } from "../store/auth";

type Template = {
  id: string;
  name: string;
  sport?: string | null;
  pages_count?: number | null;
  thumbnail_asset_id?: string | null;
  origin?: string | null;
};

export default function Dashboard() {
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const {
    clubs,
    activeClubId,
    setActiveClub,
    loadClubs,
  } = useAuth();

  const activeClub = useMemo(() => {
    if (!activeClubId) return null;
    return clubs.find((c) => String(c.id) === String(activeClubId)) ?? null;
  }, [clubs, activeClubId]);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [tplLoading, setTplLoading] = useState(false);
  const [tplError, setTplError] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    loadClubs().catch(() => void 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTemplates() {
    setTplLoading(true);
    setTplError(null);
    try {
      const res = await api.get("/api/templates");
      setTemplates((res.data as Template[]) || []);
    } catch (e: any) {
      const msg =
        e?.response?.status
          ? `API ${e.response.status}`
          : e?.message || "Error cargando plantillas";
      setTplError(msg);
      setTemplates([]);
    } finally {
      setTplLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates().catch(() => void 0);
  }, []);

  const thumbUrl = (templateId: string) =>
    `${apiUrl}/api/templates/${templateId}/thumbnail?page=0&size=520`;

  async function createFromTemplate(templateId: string) {
    if (!activeClubId) {
      setNotice("Crea o selecciona un club antes de elegir plantilla.");
      return;
    }
    setNotice(null);
    try {
      const res = await api.post(`/api/projects/from-template/${templateId}`, {
        club_id: String(activeClubId),
      });
      const projectId = (res.data as any)?.project_id;
      if (!projectId) throw new Error("No se creó project_id");
      nav(`/editor/${projectId}`);
    } catch (e: any) {
      setNotice(
        `No se pudo crear el proyecto desde la plantilla. ${
          e?.response?.status ? `[${e.response.status}]` : ""
        } ${e?.message || ""}`.trim()
      );
    }
  }

  async function importPDF(file: File) {
    if (!activeClubId) {
      setNotice("Crea o selecciona un club antes de importar un PDF.");
      return;
    }

    setImporting(true);
    setNotice("Cargando PDF... (puede tardar según el tamaño)");
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await api.post(
        `/api/import/${String(activeClubId)}?mode=custom&preset=a4_background`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      const projectId = (res.data as any)?.project_id;
      if (!projectId) throw new Error("Import devolvió respuesta sin project_id");
      nav(`/editor/${projectId}`);
    } catch (e: any) {
      setNotice(
        `No se pudo importar el PDF. ${
          e?.response?.status ? `[${e.response.status}]` : ""
        } ${e?.message || ""}`.trim()
      );
    } finally {
      setImporting(false);
    }
  }

  async function createClub(name: string) {
    setNotice(null);
    try {
      await api.post("/api/clubs", { name });
      await loadClubs();
      setNotice("Club creado.");
    } catch (e: any) {
      setNotice(`No se pudo crear el club. ${e?.message || ""}`.trim());
    }
  }

  return (
    <div className="appShell">
      {/* LEFT */}
      <div className="sidebar">
        <div className="sectionTitle">Club</div>

        <div className="card">
          <div className="small">Selecciona un club activo</div>
          <div className="row" style={{ marginTop: 8 }}>
            <select
              className="input"
              value={activeClubId ?? ""}
              onChange={(e) => setActiveClub(e.target.value || null)}
            >
              <option value="">(elige club)</option>
              {clubs.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="hr" />

          <div className="small">Crear club</div>
          <CreateClubForm onCreate={createClub} disabled={false} />
        </div>

        <div className="card">
          <div className="sectionTitle">Importar PDF</div>
          <div className="small">
            Importa tu revista en PDF para editar encima.
          </div>

          <div style={{ marginTop: 10 }}>
            <button
              className="btn btnPrimary"
              disabled={importing}
              onClick={() => fileRef.current?.click()}
            >
              {importing ? "Cargando..." : "Subir PDF"}
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) importPDF(f);
            }}
          />
        </div>

        {notice && <div className="notice">{notice}</div>}
      </div>

      {/* CENTER */}
      <div className="main">
        <div className="sectionTitle">Plantillas de revistas</div>
        <div className="small">
          Si no importas un PDF, elige una plantilla para empezar.
        </div>

        <div className="hr" />

        {tplLoading && <div className="notice">Cargando plantillas...</div>}
        {tplError && (
          <div className="notice">
            No se pudieron cargar las plantillas (API): {tplError}
          </div>
        )}

        {!tplLoading && !tplError && templates.length === 0 && (
          <div className="notice">
            No hay plantillas para mostrar. Revisa backend: GET /api/templates
          </div>
        )}

        <div className="templates">
          {templates.map((t) => (
            <div
              key={t.id}
              className="templateCard"
              onClick={() => createFromTemplate(t.id)}
              title="Usar esta plantilla"
            >
              <img
                className="templateThumb"
                src={thumbUrl(t.id)}
                loading="lazy"
                decoding="async"
                alt={t.name}
              />
              <div className="templateMeta">
                <div className="templateName">{t.name}</div>
                <div className="templateInfo">
                  {t.sport ? t.sport : "Deporte"} ·{" "}
                  {t.pages_count ? `${t.pages_count} páginas` : "—"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT */}
      <div className="inspector">
        <div className="sectionTitle">Estado</div>
        <div className="card">
          <div className="small">API Base</div>
          <div style={{ fontSize: 12, marginTop: 6, wordBreak: "break-all" }}>
            {apiUrl}
          </div>
          <div className="hr" />
          <div className="small">Club activo</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            {activeClub?.name ?? "(ninguno)"}
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateClubForm({
  onCreate,
  disabled,
}: {
  onCreate: (name: string) => void;
  disabled: boolean;
}) {
  const [name, setName] = useState("");
  return (
    <div style={{ marginTop: 8 }}>
      <input
        className="input"
        placeholder="Nombre del club"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={disabled}
      />
      <div style={{ marginTop: 10 }}>
        <button
          className="btn"
          disabled={disabled || !name.trim()}
          onClick={() => {
            const v = name.trim();
            if (!v) return;
            setName("");
            onCreate(v);
          }}
        >
          Crear
        </button>
      </div>
    </div>
  );
}

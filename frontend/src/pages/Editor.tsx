import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Stage, Layer, Rect, Image as KonvaImage, Text as KonvaText, Group } from "react-konva";
import useImage from "use-image";
import { api, apiUrl, absApi } from "../lib/api";
import { useAuth } from "../store/auth";

/**
 * Editor.tsx basado en la versión estable del zip (v1-git)
 * + FIX: detección real por página (endpoint correcto)
 * + FIX: background del PDF sin capa oscura
 * + FIX: urls absolutas para assets
 * + FIX: editar SOLO el texto clicado (no todo)
 */

const A4 = { w: 794, h: 1123 }; // px approx @ 96dpi

type OverlayText = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  confidence?: number;
};

type OverlayImage = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  asset_id?: string | null;
};

type DetectedOverlays = {
  page_index: number;
  texts: OverlayText[];
  images: OverlayImage[];
};

type ProjectDoc = {
  id: string;
  name: string;
  pages: any[];
  format?: string;
  source_pdf_asset_id?: string | null;
};

const absAsset = (ref: string | null | undefined) => {
  if (!ref) return null;
  const u = `/api/assets/file/${ref}`;
  return absApi(u);
};

export default function Editor() {
  const nav = useNavigate();
  const { projectId } = useParams();
  const { token, clubs, activeClubId } = useAuth();

  const [project, setProject] = useState<ProjectDoc | null>(null);
  const [pageIndex, setPageIndex] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [mode, setMode] = useState<"SIMPLE" | "PRO">("SIMPLE");

  // detección
  const [detectTextOn, setDetectTextOn] = useState(false);
  const [detectImagesOn, setDetectImagesOn] = useState(false);
  const [detectCache, setDetectCache] = useState<Record<number, DetectedOverlays | null>>({});
  const [detectLoading, setDetectLoading] = useState(false);

  // edición de texto por click
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");

  // assets canvas
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);

  const club = useMemo(() => {
    const id = activeClubId ? String(activeClubId) : null;
    return clubs.find((c: any) => String(c.id) === id) || clubs[0] || null;
  }, [clubs, activeClubId]);

  const lockedLogoAssetId = useMemo(() => {
    const c: any = club as any;
    return c?.locked_logo_asset_id ?? c?.lockedLogoAssetId ?? null;
  }, [club]);

  const lockedLogoUrl = useMemo(() => {
    return lockedLogoAssetId ? absApi(`/api/assets/file/${lockedLogoAssetId}`) : null;
  }, [lockedLogoAssetId]);

  // ------- cargar proyecto -------
  useEffect(() => {
    if (!token || !projectId) return;
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/api/projects/item/${projectId}`);
        if (!mounted) return;
        setProject(data);
        setPageIndex(0);
      } catch (e) {
        console.error(e);
        alert("No se pudo cargar el proyecto (API). Revisa backend/proxy.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [token, projectId]);

  // ------- detección real por página (cache) -------
  async function ensureDetect(page: number) {
    if (!projectId) return null;
    if (detectCache[page]) return detectCache[page];
    setDetectLoading(true);
    try {
      // ✅ ENDPOINT CORRECTO
      const { data } = await api.post(`/api/projects/item/${projectId}/detect/${page}`);
      setDetectCache((prev) => ({ ...prev, [page]: data as DetectedOverlays }));
      return data as DetectedOverlays;
    } catch (e) {
      console.error(e);
      setDetectCache((prev) => ({ ...prev, [page]: null }));
      return null;
    } finally {
      setDetectLoading(false);
    }
  }

  // si activas detect, precarga la página actual
  useEffect(() => {
    if ((detectTextOn || detectImagesOn) && projectId) {
      ensureDetect(pageIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectTextOn, detectImagesOn, pageIndex, projectId]);

  // ------- background de página (PDF importado) -------
  const pageBgUrl = useMemo(() => {
    if (!projectId) return null;
    // backend: /api/projects/item/{id}/page/{page_index}.png
    return absApi(`/api/projects/item/${projectId}/page/${pageIndex}.png`);
  }, [projectId, pageIndex]);

  const [bgImg] = useImage(pageBgUrl || "");

  // ------- guardar -------
  async function saveProject() {
    if (!projectId) return;
    setSaving(true);
    try {
      await api.post(`/api/projects/item/${projectId}/save`, { project });
      alert("Guardado ✅");
    } catch (e) {
      console.error(e);
      alert("Error guardando (API)");
    } finally {
      setSaving(false);
    }
  }

  // ------- export -------
  async function exportPrint() {
    if (!projectId) return;
    try {
      const res = await api.post(`/api/projects/item/${projectId}/export/print`, {}, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (e) {
      console.error(e);
      alert("Error exportando: Network Error");
    }
  }

  async function exportWeb() {
    if (!projectId) return;
    try {
      const res = await api.post(`/api/projects/item/${projectId}/export/web`, {}, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (e) {
      console.error(e);
      alert("Error exportando: Network Error");
    }
  }

  // ------- click en texto detectado -------
  function onClickDetectedText(t: OverlayText) {
    // ✅ Solo el clicado
    setEditingTextId(t.id);
    setEditingValue(t.text || "");
  }

  function applyEditedText() {
    if (!editingTextId) return;
    setDetectCache((prev) => {
      const cur = prev[pageIndex];
      if (!cur) return prev;
      return {
        ...prev,
        [pageIndex]: {
          ...cur,
          texts: cur.texts.map((t) => (t.id === editingTextId ? { ...t, text: editingValue } : t)),
        },
      };
    });
    setEditingTextId(null);
  }

  // ------- UI -------
  if (loading || !project) {
    return (
      <div className="page">
        <div className="panel">
          <div className="panelTitle">Cargando…</div>
          <div className="muted">Cargando proyecto…</div>
        </div>
      </div>
    );
  }

  const overlays = detectCache[pageIndex] || null;

  return (
    <div className="page editorLayout">
      {/* HEADER */}
      <div className="topbar">
        <div className="brand">
          <div className="brandLogo">
            {lockedLogoUrl ? <img src={lockedLogoUrl} alt="logo" /> : <div className="logoPlaceholder" />}
          </div>
          <div className="brandTxt">
            <div className="brandName">Sports Magazine</div>
            <div className="brandSub">Editor</div>
          </div>
        </div>

        <div className="topbarRight">
          <button className="btn" onClick={() => nav("/dashboard")}>Dashboard</button>
          <button className="btn danger" onClick={() => nav("/dashboard")}>Salir</button>
        </div>
      </div>

      {/* LEFT PANEL */}
      <div className="leftPanel">
        <div className="panel card">
          <div className="panelTitle">{project.name}</div>
          <div className="muted">
            {project.format || "A4"} · {project.pages?.length || 0} páginas
          </div>

          <div className="row mt">
            <button className="btn" disabled={saving} onClick={saveProject}>Guardar</button>
            <button className="btn purple" onClick={exportWeb}>Export WEB</button>
          </div>
          <div className="row mt">
            <button className="btn purple" onClick={exportPrint}>Export IMPRENTA</button>
          </div>

          <div className="mt2">
            <div className="muted">Detección (PDF importado)</div>
            <div className="row mt">
              <button
                className={`btn ${detectTextOn ? "purple" : ""}`}
                onClick={() => setDetectTextOn((v) => !v)}
              >
                Texto
              </button>
              <button
                className={`btn ${detectImagesOn ? "purple" : ""}`}
                onClick={() => setDetectImagesOn((v) => !v)}
              >
                Imágenes
              </button>
              <button
                className="btn"
                onClick={() => {
                  setDetectTextOn(true);
                  setDetectImagesOn(true);
                }}
              >
                Activar ambos
              </button>
            </div>
            {detectLoading && <div className="muted mt">Detectando…</div>}
          </div>

          <div className="mt2">
            <div className="muted">Modo editor</div>
            <div className="row mt">
              <button className={`btn ${mode === "SIMPLE" ? "purple" : ""}`} onClick={() => setMode("SIMPLE")}>SIMPLE</button>
              <button className={`btn ${mode === "PRO" ? "purple" : ""}`} onClick={() => setMode("PRO")}>PRO</button>
            </div>
          </div>
        </div>

        <div className="panel card mt2">
          <div className="panelTitle">Página</div>
          <div className="row mt">
            <button className="btn" onClick={() => setPageIndex((p) => Math.max(0, p - 1))}>◀</button>
            <div className="muted">
              {pageIndex + 1} / {project.pages?.length || 1}
            </div>
            <button className="btn" onClick={() => setPageIndex((p) => Math.min((project.pages?.length || 1) - 1, p + 1))}>▶</button>
          </div>
        </div>

        {/* editor de texto detectado (solo el clicado) */}
        {editingTextId && (
          <div className="panel card mt2">
            <div className="panelTitle">Editar texto detectado</div>
            <textarea
              className="textarea"
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              style={{ minHeight: 120, whiteSpace: "pre-wrap" }}
            />
            <div className="row mt">
              <button className="btn purple" onClick={applyEditedText}>Aplicar</button>
              <button className="btn" onClick={() => setEditingTextId(null)}>Cancelar</button>
            </div>
            <div className="muted mt">
              En modo PRO puedes meter saltos de línea con Enter (se respetan).
            </div>
          </div>
        )}
      </div>

      {/* CANVAS CENTER */}
      <div className="centerPanel" ref={canvasWrapRef}>
        <div className="canvasCard">
          <Stage width={A4.w} height={A4.h}>
            {/* BACKGROUND */}
            <Layer>
              {/* ✅ Sin capa oscura: opacity 1, fill transparente */}
              <Rect x={0} y={0} width={A4.w} height={A4.h} fill="transparent" opacity={1} />
              {bgImg && (
                <KonvaImage
                  x={0}
                  y={0}
                  width={A4.w}
                  height={A4.h}
                  image={bgImg}
                  opacity={1}
                />
              )}
            </Layer>

            {/* DETECT LAYER */}
            {(detectTextOn || detectImagesOn) && overlays && (
              <Layer>
                {/* Images overlays */}
                {detectImagesOn &&
                  overlays.images?.map((im) => (
                    <Rect
                      key={im.id}
                      x={im.x}
                      y={im.y}
                      width={im.w}
                      height={im.h}
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dash={[6, 6]}
                      listening={true}
                      onClick={() => {
                        alert("Overlay imagen detectada. (Aquí va el reemplazo por asset en tu siguiente iteración)");
                      }}
                    />
                  ))}

                {/* Text overlays */}
                {detectTextOn &&
                  overlays.texts?.map((t) => (
                    <Group key={t.id} onClick={() => onClickDetectedText(t)}>
                      <Rect
                        x={t.x}
                        y={t.y}
                        width={t.w}
                        height={t.h}
                        stroke="#22c55e"
                        strokeWidth={2}
                        dash={[6, 6]}
                      />
                      <KonvaText
                        x={t.x + 6}
                        y={t.y + 4}
                        width={Math.max(10, t.w - 12)}
                        height={Math.max(10, t.h - 8)}
                        text={t.text || ""}
                        fontSize={12}
                        fill="#e5e7eb"
                        listening={false}
                      />
                    </Group>
                  ))}
              </Layer>
            )}
          </Stage>
        </div>
      </div>
    </div>
  );
}

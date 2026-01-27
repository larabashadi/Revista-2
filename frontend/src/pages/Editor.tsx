import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import { Stage, Layer, Rect, Text, Image as KImage, Transformer, Group } from "react-konva";

const A4_W = 595.2756;
const A4_H = 841.8898;

// Base URL for backend when frontend is hosted separately (e.g., Render).
// In dev, Vite proxy handles relative /api calls, so VITE_API_BASE can be empty.
const API_BASE = String((import.meta as any)?.env?.VITE_API_BASE || "").replace(/\/+$/, "");
const withApiBase = (path: string) => (API_BASE ? `${API_BASE}${path.startsWith("/") ? path : `/${path}`}` : path);
const assetFileUrl = (assetId: string) => withApiBase(`/api/assets/file/${assetId}`);

type ImgMap = Record<string, HTMLImageElement>;

const uuid = () =>
  (globalThis.crypto && (crypto as any).randomUUID)
    ? (crypto as any).randomUUID()
    : `id-${Math.random().toString(16).slice(2)}-${Date.now()}`;

const safeClone = <T,>(obj: T): T => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sc = (globalThis as any).structuredClone;
  if (sc) return sc(obj);
  return JSON.parse(JSON.stringify(obj));
};

function loadImg(url: string, onError?: () => void): HTMLImageElement {
  const img = new Image();
  // Only set crossOrigin for remote http(s) images.
  // Setting it for data:/blob: can break rendering in some browsers.
  if (/^https?:\/\//i.test(url)) {
    img.crossOrigin = "anonymous";
  }
  img.onload = () => void 0;
  img.onerror = () => onError?.();
  img.src = url;
  return img;
}

function stripHtml(s: string) {
  return s.replace(/<[^>]*>/g, "");
}

type Run = {
  text: string;
  marks?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string;
    size?: number;
    font?: string;
    bg?: string;
  };
};

const FONT_OPTIONS = [
  "Inter",
  "Roboto",
  "Montserrat",
  "Poppins",
  "Oswald",
  "Bebas Neue",
  "Playfair Display",
  "Georgia",
  "Times New Roman",
  "Arial",
];

function rgbaFromHex(hex: string, a: number) {
  const h = (hex || "#000000").replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  const alpha = Math.max(0, Math.min(1, a));
  return `rgba(${r},${g},${b},${alpha})`;
}

function clamp255(n: number) {
  const x = Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(255, Math.round(x)));
}
function hexFromRgb(rgb: any): string {
  if (!Array.isArray(rgb) || rgb.length < 3) return "#111827";
  const r = clamp255(rgb[0]);
  const g = clamp255(rgb[1]);
  const b = clamp255(rgb[2]);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
function rgbaFromRgb(rgb: any, a: number) {
  if (!Array.isArray(rgb) || rgb.length < 3) return rgbaFromHex("#000000", a);
  const r = clamp255(rgb[0]);
  const g = clamp255(rgb[1]);
  const b = clamp255(rgb[2]);
  const alpha = Math.max(0, Math.min(1, a));
  return `rgba(${r},${g},${b},${alpha})`;
}

function parseRgba(s: string): { hex: string; a: number } {
  const v = (s || "").trim();
  if (!v || v === "transparent") return { hex: "#ffffff", a: 0 };
  if (v.startsWith("#")) return { hex: v, a: 1 };
  const m = v.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\)/i);
  if (!m) return { hex: "#ffffff", a: 0.85 };
  const r = Math.max(0, Math.min(255, parseInt(m[1], 10) || 0));
  const g = Math.max(0, Math.min(255, parseInt(m[2], 10) || 0));
  const b = Math.max(0, Math.min(255, parseInt(m[3], 10) || 0));
  const a = m[4] !== undefined ? Math.max(0, Math.min(1, parseFloat(m[4]) || 0)) : 1;
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return { hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`, a };
}

function runsFromHtml(html: string): Run[] {
  // Parse very small subset: <span style="color:...; font-size:...px; font-weight:bold; font-style:italic">text</span>
  const div = document.createElement("div");
  div.innerHTML = html || "";
  const runs: Run[] = [];

  const walk = (node: Node, currentMarks: Run["marks"]) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent || "");
      if (t) runs.push({ text: t, marks: { ...currentMarks } });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const nextMarks: Run["marks"] = { ...currentMarks };

    // Support both inline styles and legacy <font> tags produced by execCommand.
    if (el.tagName === "B" || el.style.fontWeight === "bold" || parseInt(el.style.fontWeight || "0", 10) >= 700) nextMarks.bold = true;
    if (el.tagName === "I" || el.style.fontStyle === "italic") nextMarks.italic = true;
    if (el.tagName === "U" || el.style.textDecoration.includes("underline")) nextMarks.underline = true;
    const fontEl = el.tagName === "FONT" ? el : null;
    const fontColorAttr = fontEl?.getAttribute("color") || "";
    const fontFaceAttr = fontEl?.getAttribute("face") || "";
    const fontSizeAttr = fontEl?.getAttribute("size") || "";

    if (el.style.color) nextMarks.color = el.style.color;
    else if (fontColorAttr) nextMarks.color = fontColorAttr;

    if (el.style.backgroundColor) nextMarks.bg = el.style.backgroundColor;

    if (el.style.fontFamily) nextMarks.font = el.style.fontFamily;
    else if (fontFaceAttr) nextMarks.font = fontFaceAttr;
    if (el.style.fontSize) {
      const n = parseInt(el.style.fontSize.replace("px", ""), 10);
      if (!Number.isNaN(n)) nextMarks.size = n;
    } else if (fontSizeAttr) {
      const s = parseInt(fontSizeAttr, 10);
      // HTML font sizes 1..7 – map roughly to px
      const map: Record<number, number> = { 1: 10, 2: 12, 3: 14, 4: 18, 5: 24, 6: 32, 7: 48 };
      if (!Number.isNaN(s) && map[s]) nextMarks.size = map[s];
    }

    Array.from(el.childNodes).forEach((c) => walk(c, nextMarks));
    if (el.tagName === "DIV" || el.tagName === "P" || el.tagName === "BR") {
      runs.push({ text: "\n", marks: { ...currentMarks } });
    }
  };

  Array.from(div.childNodes).forEach((n) => walk(n, {}));
  // Merge adjacent identical marks
  const merged: Run[] = [];
  for (const r of runs) {
    const prev = merged[merged.length - 1];
    const a = JSON.stringify(prev?.marks || {});
    const b = JSON.stringify(r.marks || {});
    if (prev && a === b) prev.text += r.text;
    else merged.push({ text: r.text, marks: r.marks || {} });
  }
  return merged.filter(r => r.text.length);
}

function htmlFromRuns(runs: Run[]) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return runs.map(r => {
    const m = r.marks || {};
    let style = "";
    if (m.color) style += `color:${m.color};`;
    if (m.bg) style += `background-color:${m.bg};`;
    if (m.size) style += `font-size:${m.size}px;`;
    if (m.font) style += `font-family:${m.font};`;
    if (m.bold) style += "font-weight:bold;";
    if (m.italic) style += "font-style:italic;";
    if (m.underline) style += "text-decoration:underline;";
    const t = esc(r.text).replace(/\n/g, "<br/>");
    return style ? `<span style="${style}">${t}</span>` : t;
  }).join("");
}

export default function Editor() {
  const { projectId } = useParams();
  const nav = useNavigate();
  const { clubs, activeClubId } = useAuth();
  const club = useMemo(() => clubs.find((c) => c.id === activeClubId) || null, [clubs, activeClubId]);

  const [project, setProject] = useState<any>(null);
  const [doc, setDoc] = useState<any>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(0.9);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // PDF detection overlays are OFF by default.
  const [detectTextByPage, setDetectTextByPage] = useState<Record<number, boolean>>({});
  const [detectImagesByPage, setDetectImagesByPage] = useState<Record<number, boolean>>({});

  // Editor modes
  // - simple: quick edits (Canva-like)
  // - pro: rich text runs + advanced tools (InDesign-light)
  const [editorMode, setEditorMode] = useState<"simple" | "pro">(() => {
    const v = localStorage.getItem("sms_editor_mode");
    return v === "pro" ? "pro" : "simple";
  });
  useEffect(() => {
    localStorage.setItem("sms_editor_mode", editorMode);
  }, [editorMode]);

  const [imgMap, setImgMap] = useState<ImgMap>({});
  const inflight = useRef<Set<string>>(new Set());

  const stageRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  // Rich text editor (PRO panel)
  const [rtHtml, setRtHtml] = useState("");
  const [rtTargetId, setRtTargetId] = useState<string | null>(null);
  const rtDivRef = useRef<HTMLDivElement | null>(null);

  // Simple text editor buffer
  const [simpleText, setSimpleText] = useState("");

  // Text background controls (for detected text boxes and normal text frames)
  const [textBgHex, setTextBgHex] = useState("#ffffff");
  const [textBgA, setTextBgA] = useState(0.85);

  // Side PRO editor (Option A)

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bgFileInputRef = useRef<HTMLInputElement | null>(null);

  const safePageIndex = Math.max(0, Math.min(pageIndex, (doc?.pages?.length || 1) - 1));
  const page = doc?.pages?.[safePageIndex];

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/api/projects/item/${projectId}`);
        setProject(data);
        setDoc(data.document);
        setPageIndex(0);
        setSelectedId(null);
      } catch (e: any) {
        console.error(e);
        setToast("No se pudo cargar el proyecto (API). Revisa backend/proxy.");
      }
    })();
  }, [projectId]);

  // Preload images used in current page (and locked logo)
  useEffect(() => {
    if (!doc?.pages?.length) return;
    const p = doc.pages[Math.max(0, Math.min(pageIndex, doc.pages.length - 1))];
    if (!p) return;

    const urls = new Set<string>();
    for (const layer of p.layers || []) {
      for (const it of layer.items || []) {
        if (it.type === "ImageFrame" && it.assetRef && !String(it.assetRef).startsWith("{{")) {
          urls.add(assetFileUrl(String(it.assetRef)));
        }
        if (it.type === "LockedLogoStamp" && club?.locked_logo_asset_id) {
          urls.add(assetFileUrl(String(club.locked_logo_asset_id)));
        }
      }
    }
    urls.forEach((url) => {
      if (imgMap[url] || inflight.current.has(url)) return;
      inflight.current.add(url);
      const img = loadImg(url, () => {
        inflight.current.delete(url);
      });
      img.onload = () => {
        setImgMap((prev) => ({ ...prev, [url]: img }));
        inflight.current.delete(url);
      };
    });
  }, [doc, pageIndex, club?.locked_logo_asset_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Transformer binding
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    if (!selectedId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const node = stage.findOne(`#${selectedId}`);
    if (node) tr.nodes([node]);
    else tr.nodes([]);
    tr.getLayer()?.batchDraw();
  }, [selectedId, doc, pageIndex]);

  // Sync bg controls when selection changes
  useEffect(() => {
    if (!selectedId) return;
    const f = findItem(selectedId);
    if (!f || f.it.type !== "TextFrame") return;
    const parsed = parseRgba(String(f.it.bg || "rgba(255,255,255,0)"));
    setTextBgHex(parsed.hex);
    setTextBgA(parsed.a);
  }, [selectedId]);

  // Keep SIMPLE text buffer in sync with selected TextFrame
  useEffect(() => {
    if (editorMode !== "simple") return;
    if (!selectedId) return;
    const f = findItem(selectedId);
    if (!f || f.it.type !== "TextFrame") return;
    const v = f.it.text;
    if (Array.isArray(v)) {
      setSimpleText(v.map((r: any) => r?.text || "").join(""));
    } else {
      setSimpleText(String(v || ""));
    }
  }, [selectedId, doc, pageIndex, editorMode]);

  const findItem = (id: string) => {
    if (!doc?.pages?.length) return null;
    const p = doc.pages[safePageIndex];
    for (const layer of p.layers || []) {
      for (const it of layer.items || []) {
        if (it.id === id) return { layer, it };
      }
    }
    return null;
  };

  const updateItem = (id: string, patch: any) => {
    setDoc((prev: any) => {
      const next = safeClone(prev);
      const p = next.pages[safePageIndex];
      for (const layer of p.layers || []) {
        const idx = (layer.items || []).findIndex((x: any) => x.id === id);
        if (idx >= 0) {
          layer.items[idx] = { ...layer.items[idx], ...patch };
          break;
        }
      }
      return next;
    });
  };

  const updateItemRect = (id: string, rectPatch: any) => {
    updateItem(id, { rect: { ...(findItem(id)?.it?.rect || {}), ...rectPatch } });
  };

  const save = async () => {
    try {
      // Persist page-by-page to keep saves lightweight.
      // Backend also supports full document PUT as a fallback.
      try {
        await api.put(`/api/projects/item/${projectId}/page/${safePageIndex}`, {
          page: doc.pages?.[safePageIndex],
        });
      } catch {
        await api.put(`/api/projects/item/${projectId}`, { document: doc });
      }
      showToast("Guardado ✅");
    } catch (e: any) {
      console.error(e);
      showToast("Error guardando");
    }
  };

  // Auto-save: persist changes shortly after edits (page-level signature)
  const autoSaveTimer = useRef<number | null>(null);
  const lastSavedSig = useRef<string>("");

  useEffect(() => {
    if (!projectId || !doc) return;
    const p = doc.pages?.[pageIndex];
    if (!p) return;

    let sig = "";
    try {
      sig = JSON.stringify(p);
    } catch {
      return;
    }
    if (sig === lastSavedSig.current) return;

    if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = window.setTimeout(async () => {
      try {
        await api.put(`/api/projects/item/${projectId}`, { document: doc });
        lastSavedSig.current = sig;
      } catch (e) {
        console.error("autosave failed", e);
      }
    }, 700);

    return () => {
      if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    };
  }, [projectId, doc, pageIndex]);


  // Small id helper (optionally with a prefix) to avoid collisions.
  const newId = (prefix = "id") => {
    const fallback = () => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    try {
      // @ts-ignore
      const uuid = crypto?.randomUUID?.();
      return uuid ? `${prefix}_${uuid}` : fallback();
    } catch {
      return fallback();
    }
  };

  const ensureContentLayer = (page: any) => {
    page.layers = page.layers || [];
    let layer = page.layers.find((l: any) => l.id === "content" || l.name === "Contenido");
    if (!layer) {
      layer = { id: "content", name: "Contenido", visible: true, items: [] };
      page.layers.push(layer);
    }
    layer.items = layer.items || [];
    return layer;
  };

  const normalizeHexStrict = (hex: string) => {
    const h = (hex || "").trim();
    if (!h) return "#0b1220";
    if (h.startsWith("#") && (h.length === 7 || h.length === 4)) {
      if (h.length === 7) return h.toLowerCase();
      // #rgb -> #rrggbb
      const r = h[1], g = h[2], b = h[3];
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return "#0b1220";
  };

  const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

  const lightenHex = (hex: string, amount01: number) => {
    const h = normalizeHexStrict(hex);
    const amt = clamp(amount01, 0, 1);
    const r = parseInt(h.slice(1, 3), 16);
    const g = parseInt(h.slice(3, 5), 16);
    const b = parseInt(h.slice(5, 7), 16);
    const lr = Math.round(r + (255 - r) * amt);
    const lg = Math.round(g + (255 - g) * amt);
    const lb = Math.round(b + (255 - b) * amt);
    const to2 = (x: number) => x.toString(16).padStart(2, "0");
    return `#${to2(lr)}${to2(lg)}${to2(lb)}`;
  };

  const createThemeBackgroundItems = (document: any) => {
    // Use document style tokens when available to keep the magazine "look".
    const tokens = document?.styles?.colorTokens || {};
    const accent = normalizeHexStrict(tokens.accent || tokens.primary || "#0b1220");
    const bg = normalizeHexStrict(tokens.pageBg || tokens.bg || lightenHex(accent, 0.92));
    const band = accent;
    return [
      {
        id: newId("bg"),
        type: "Shape",
        rect: { x: 0, y: 0, w: A4_W, h: A4_H },
        fill: bg,
      },
      {
        id: newId("band"),
        type: "Shape",
        rect: { x: 0, y: 0, w: A4_W, h: 82 },
        fill: band,
      },
    ];
  };

  const promoteDetectedItem = (itemId: string) => {
    setDoc((prev: any) => {
      const next = safeClone(prev);
      const p = next.pages?.[safePageIndex];
      if (!p) return prev;
      const layers = p.layers || [];
      const detected = layers.find((l: any) => (l?.id || "").includes("detected"));
      if (!detected) return prev;
      const idx = (detected.items || []).findIndex((x: any) => x.id === itemId);
      if (idx < 0) return prev;
      const it = detected.items[idx];

      // Move into editable content layer
      const content = ensureContentLayer(p);
      const moved = { ...it, id: newId() };
      // Make detected text immediately legible by enabling a background by default.
      if (moved.type === "TextFrame") {
        // Some imports store background color in `bg`, others in `bg_hex`. Normalize.
        const bg = (moved.bg_hex || moved.bg || "#ffffff");
        moved.bg = bg;
        moved.bg_hex = bg;
      }
      content.items.push(moved);

      // Remove from detected layer to avoid duplicating everything.
      detected.items.splice(idx, 1);
      return next;
    });
  };

  const deleteItemAnyLayer = (itemId: string) => {
    setDoc((prev: any) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev));
      for (const p of next.pages || []) {
        for (const l of p.layers || []) {
          if (Array.isArray(l.items)) {
            l.items = l.items.filter((it: any) => it?.id !== itemId);
          }
        }
      }
      return next;
    });
    if (selectedId === itemId) setSelectedId(null);
  };

  const ensureDetectedForPage = async (pageIndex: number) => {
    if (!projectId || !doc?.pages?.[pageIndex]) return;
    const p = doc.pages[pageIndex];
    const hasDetectedLayer = (p.layers || []).some((l: any) => String(l.id || "").startsWith("detected_"));
    if (hasDetectedLayer) return;

    try {
      const res = await api.post(`/api/projects/item/${projectId}/detect/${pageIndex}`);
      const detected = res.data || {};
      setDoc((prev: any) => {
        if (!prev) return prev;
        const next = JSON.parse(JSON.stringify(prev));
        const page = next.pages[pageIndex];
        page.layers = page.layers || [];

        const toRect = (src: any) => {
          const r = Array.isArray(src?.rect) ? src.rect : null;
          if (r && r.length >= 4) {
            const x0 = Number(r[0]) || 0;
            const y0 = Number(r[1]) || 0;
            const x1 = Number(r[2]) || 0;
            const y1 = Number(r[3]) || 0;
            return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
          }
          const x = Number(src?.x) || 0;
          const y = Number(src?.y) || 0;
          const w = Number(src?.w ?? src?.width) || 1;
          const h = Number(src?.h ?? src?.height) || 1;
          return { x, y, w: Math.max(1, w), h: Math.max(1, h) };
        };

        const textItems = (detected.text || []).map((t: any) => {
          const rect = toRect(t);
          const colorHex = t.color_hex || (Array.isArray(t.color) ? hexFromRgb(t.color) : "#111827");
          const bgHex = t.bg_hex || (Array.isArray(t.bg) ? hexFromRgb(t.bg) : "#ffffff");
          const bgFill = Array.isArray(t.bg) ? rgbaFromRgb(t.bg, 0.92) : rgbaFromHex(bgHex, 0.92);
          return {
            id: `detected_text_${t.id ?? uuid()}`,
            type: "TextFrame",
            rect,
            text: t.text || "",
            font: "Inter",
            size: Number(t.size) || 14,
            color: colorHex,
            bg: bgFill,
            bg_hex: bgHex,
          };
        });

        const imgItems = (detected.images || []).map((im: any) => {
          const rect = toRect(im);
          return {
            id: `detected_img_${im.id ?? uuid()}`,
            type: "ImageFrame",
            rect,
            // if backend provides extracted asset, show it; otherwise user can replace
            assetRef: im.asset_id || im.assetRef || null,
            fitMode: "cover",
            crop: { x: 0, y: 0, w: 1, h: 1 },
          };
        });

        page.layers = page.layers.filter((l: any) => !String(l.id || "").startsWith("detected_"));
        if (textItems.length) page.layers.push({ id: "detected_text", role: "overlay", items: textItems });
        if (imgItems.length) page.layers.push({ id: "detected_images", role: "overlay", items: imgItems });
        return next;
      });
    } catch (e) {
      console.error(e);
    }
  };

  const exportPdf = async (quality: "web" | "print") => {
    try {
      const safeName = (s: string) => (s || "")
        .trim()
        .replace(/[^a-zA-Z0-9\- _]/g, "_")
        .replace(/\s+/g, "_")
        .slice(0, 80) || "Club";
      const clubName = safeName(club?.name || "Club");
      const downloadName = `Revista_${clubName}.pdf`;

      // 1) Create export job
      const { data } = await api.post(`/api/export/${projectId}`, { quality });
      const jobId: string = data.job_id;

      // 2) Poll job status
      const started = Date.now();
      let exportAssetId: string | null = null;
      while (Date.now() - started < 120_000) {
        // backend exposes /api/export/job/{job_id}; older builds used /status.
        const st = await api.get(`/api/export/job/${jobId}`);
        const s = st.data?.status;
        if (s === "failed") {
          throw new Error(st.data?.error || "Export failed");
        }
        if (s === "finished") {
          exportAssetId = st.data?.export_asset_id || st.data?.result?.export_asset_id;
          break;
        }
        await new Promise((r) => setTimeout(r, 800));
      }
      if (!exportAssetId) throw new Error("Export timeout");

      // 3) Download as blob (so it works with auth/proxy)
      const res = await api.get(`/api/export/download/${exportAssetId}?filename=${encodeURIComponent(downloadName)}`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("PDF listo ✅");
    } catch (e: any) {
      console.error(e);
      // Fallback: if the background worker/queue fails, try synchronous export.
      try {
        const res2 = await api.post(`/api/export/sync/${projectId}`, { quality }, { responseType: "blob" as any });
        const blob2 = new Blob([res2.data], { type: "application/pdf" });
        const url2 = URL.createObjectURL(blob2);
        const a2 = document.createElement("a");
        a2.href = url2;
        const safeName2 = (s: string) => (s || "")
          .trim()
          .replace(/[^a-zA-Z0-9\- _]/g, "_")
          .replace(/\s+/g, "_")
          .slice(0, 80) || "Club";
        const clubName2 = safeName2(club?.name || "Club");
        a2.download = `Revista_${clubName2}.pdf`;
        document.body.appendChild(a2);
        a2.click();
        a2.remove();
        URL.revokeObjectURL(url2);
        showToast("PDF listo ✅");
        return;
      } catch (e2: any) {
        console.error(e2);
      }
      const msg = (e?.message || e?.response?.data?.detail || "Error exportando").toString();
      showToast(`Error exportando: ${msg}`);
    }
  };

  const getEditableLayer = (p: any) => {
    const layers = p.layers || [];
    // IMPORTANT: never add user content into the detected/overlay layer.
    // That layer is often hidden by default (showDetected* toggles), which makes
    // newly added text/images look like they "don't work".
    const isDetected = (l: any) =>
      (l.id === "overlay") || String(l.name || "").toLowerCase().includes("detectado");
    const first = layers.find((l: any) => l.locked !== true && !isDetected(l));
    if (first) return first;
    // create one
    const nl = { id: uuid(), name: "Contenido", visible: true, locked: false, items: [] };
    layers.push(nl);
    return nl;
  };

  const addTextFrame = () => {
    if (!doc || !page) return;
    const id = uuid();
    const tf = {
      id,
      type: "TextFrame",
      rect: { x: 70, y: 120, w: 380, h: 90 },
      text: [{ text: "Doble click para editar. Puedes mezclar estilos en una frase.", marks: {} }],
      styleRef: "Body",
      padding: 10,
    };
    setDoc((prev: any) => {
      const next = safeClone(prev);
      const p = next.pages[safePageIndex];
      const layer = getEditableLayer(p);
      layer.items = layer.items || [];
      layer.items.push(tf);
      return next;
    });
    setSelectedId(id);
  };

  const addImageFrameFromAsset = (assetId: string) => {
    const id = uuid();
    const im = {
      id,
      type: "ImageFrame",
      rect: { x: 80, y: 250, w: 420, h: 240 },
      assetRef: assetId,
      fitMode: "cover",
      crop: { x: 0, y: 0, w: 1, h: 1 },
      role: "user_image",
    };
    setDoc((prev: any) => {
      const next = safeClone(prev);
      const p = next.pages[safePageIndex];
      const layer = getEditableLayer(p);
      layer.items = layer.items || [];
      layer.items.push(im);
      return next;
    });
    setSelectedId(id);
  };

  const uploadAsset = async (file: File) => {
    if (!club) throw new Error("No hay club activo");
    const fd = new FormData();
    fd.append("file", file);
    const { data } = await api.post(`/api/assets/${club.id}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
    return data.id as string;
  };

  const onPickImage = async (file: File) => {
    try {
      const id = await uploadAsset(file);
      // If an ImageFrame is selected, replace it (automatic replace)
      const sel = selectedId ? findItem(selectedId)?.it : null;
      if (sel && sel.type === "ImageFrame") {
        updateItem(sel.id, {
          assetRef: id,
          fitMode: sel.fitMode || "cover",
          crop: sel.crop || { x: 0, y: 0, w: 1, h: 1 },
        });
        showToast("Imagen reemplazada ✅");
      } else {
        addImageFrameFromAsset(id);
        showToast("Imagen añadida ✅");
      }
    } catch (e) {
      console.error(e);
      showToast("Error subiendo imagen");
    }
  };

  const onPickBackground = async (file: File) => {
    if (!page) return;
    // find background item
    const bg = (page.layers || [])
      .flatMap((l: any) => l.items || [])
      .find((it: any) => it.type === "ImageFrame" && (it.role === "page_background" || it.role === "pdf_background"));
    if (!bg) {
      showToast("Esta página no tiene fondo detectado");
      return;
    }
    try {
      const id = await uploadAsset(file);
      updateItem(bg.id, { assetRef: id });
      showToast("Fondo actualizado ✅");
    } catch (e) {
      console.error(e);
      showToast("Error cambiando fondo");
    }
  };

  const openRichText = (id: string) => {
    const f = findItem(id);
    if (!f || f.it.type !== "TextFrame") return;
    const runs: Run[] = Array.isArray(f.it.text) ? f.it.text : [{ text: String(f.it.text || ""), marks: {} }];
    const html = htmlFromRuns(runs);
    setRtTargetId(id);
    setRtHtml(html);
    // PRO editor lives in the right panel
    setTimeout(() => {
      if (rtDivRef.current) rtDivRef.current.innerHTML = html;
    }, 0);
  };

  const saveRichText = () => {
    if (!rtTargetId || !rtDivRef.current) return;
    const html = rtDivRef.current.innerHTML;
    const runs = runsFromHtml(html);
    updateItem(rtTargetId, { text: runs });
    showToast("Texto actualizado ✅");
  };

  const applySimpleText = () => {
    if (!selectedId) return;
    const f = findItem(selectedId);
    if (!f || f.it.type !== "TextFrame") return;
    updateItem(selectedId, { text: String(simpleText || "") });
    showToast("Texto actualizado ✅");
  };

  const applyTextBg = (on: boolean) => {
    if (!selectedId) return;
    const f = findItem(selectedId);
    if (!f || f.it.type !== "TextFrame") return;
    if (!on) {
      updateItem(selectedId, { bg: "rgba(255,255,255,0)" });
      return;
    }
    updateItem(selectedId, { bg: rgbaFromHex(textBgHex, textBgA) });
  };

  const duplicatePage = () => {
    if (!doc?.pages?.length) return;
    setDoc((prev: any) => {
      const next = safeClone(prev);
      const p = next.pages[safePageIndex];
      const cloned = safeClone(p);
      cloned.id = uuid();
      // new ids for items
      for (const layer of cloned.layers || []) {
        layer.id = uuid();
        layer.items = (layer.items || []).map((it: any) => ({ ...it, id: uuid() }));
      }
      next.pages.splice(safePageIndex + 1, 0, cloned);
      return next;
    });
    showToast("Página duplicada ✅");
  };

  const addBlankPage = () => {
    if (!doc?.pages) return;
    setDoc((prev: any) => {
      const next = safeClone(prev);
      const bgItems: any[] = createThemeBackgroundItems(next);
      const pageId = uuid();
      const newPage = {
        id: pageId,
        size: { w: A4_W, h: A4_H },
        layers: [
          { id: uuid(), name: "Contenido", visible: true, locked: false, items: bgItems },
        ],
      };
      next.pages = next.pages || [];
      next.pages.splice(safePageIndex + 1, 0, newPage);
      return next;
    });
    setPageIndex(safePageIndex + 1);
    showToast("Página añadida ✅");
  };

  const addSponsorsPage = () => {
    if (!doc?.pages) return;
    const countStr = window.prompt("¿Cuántos espacios de sponsor? (ej: 6)", "6");
    if (!countStr) return;
    const count = Math.max(1, Math.min(24, parseInt(countStr, 10) || 6));
    const orient = (window.prompt("¿Distribución? escribe 'v' (vertical) o 'h' (horizontal)", "h") || "h")
      .trim()
      .toLowerCase()
      .startsWith("v")
      ? "v"
      : "h";

    setDoc((prev: any) => {
      const next = safeClone(prev);
      const bgItems: any[] = createThemeBackgroundItems(next);
      const items: any[] = [];
      const margin = 48;
      const gutter = 18;
      const usableW = A4_W - margin * 2;
      const usableH = A4_H - margin * 2;

      // grid: try to keep reasonable aspect cells
      let cols = orient === "h" ? Math.ceil(Math.sqrt(count)) : Math.max(1, Math.floor(Math.sqrt(count)));
      let rows = Math.ceil(count / cols);
      if (orient === "v") {
        rows = Math.ceil(Math.sqrt(count));
        cols = Math.ceil(count / rows);
      }
      cols = Math.max(1, Math.min(6, cols));
      rows = Math.max(1, Math.min(8, rows));

      const cellW = (usableW - gutter * (cols - 1)) / cols;
      const cellH = (usableH - gutter * (rows - 1)) / rows;

      let i = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (i >= count) break;
          const x = margin + c * (cellW + gutter);
          const y = margin + r * (cellH + gutter);
          items.push({
            id: uuid(),
            type: "ImageFrame",
            rect: { x, y, w: cellW, h: cellH },
            assetRef: null,
            role: "sponsor_slot",
            opacity: 1,
          });
          i++;
        }
      }

      const newPage = {
        id: uuid(),
        size: { w: A4_W, h: A4_H },
        layers: [
          { id: uuid(), name: "Sponsors", visible: true, locked: false, items: [...bgItems, ...items] },
        ],
      };
      next.pages = next.pages || [];
      next.pages.splice(safePageIndex + 1, 0, newPage);
      return next;
    });
    setPageIndex(safePageIndex + 1);
    showToast("Página de sponsors añadida ✅");
  };

  const selectBackgroundItem = () => {
    if (!page) return;
    const bg = (page.layers || [])
      .flatMap((l: any) => l.items || [])
      .find((it: any) => it.type === "ImageFrame" && (it.role === "page_background" || it.role === "pdf_background"));
    if (!bg) return showToast("No hay fondo en esta página");
    setSelectedId(bg.id);
    showToast("Fondo seleccionado");
  };

  // Render helpers
  const measureRef = useRef<HTMLCanvasElement | null>(null);
  const measureText = (text: string, font: string) => {
    if (!measureRef.current) measureRef.current = document.createElement("canvas");
    const ctx = measureRef.current.getContext("2d")!;
    ctx.font = font;
    return ctx.measureText(text).width;
  };

  const normalizeHex = (c: any, fallback = "#111827") => {
    const s = String(c || "").trim();
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
    if (/^#[0-9a-fA-F]{3}$/.test(s)) {
      return "#" + s.slice(1).split("").map((ch) => ch + ch).join("");
    }
    return fallback;
  };

  const buildTextSegments = (frame: any, style: any) => {
    // NOTE: TextFrames are rendered inside a Konva Group positioned at frame.rect.x/y.
    // Therefore, segment coordinates must be RELATIVE to the group (0,0).
    const r = frame.rect;
    const padding = frame.padding ?? 10;
    const x0 = padding;
    const y0 = padding;
    const w = Math.max(10, r.w - padding * 2);

    const runs: Run[] = Array.isArray(frame.text)
      ? frame.text
      : [{ text: String(frame.text || ""), marks: {} }];

    const segments: Array<{ x: number; y: number; text: string; fontSize: number; fontStyle: string; fill: string; fontFamily: string; bg?: string }> = [];
    let x = 0;
    let y = 0;
    // Allow per-frame overrides so Inspector changes actually affect rendering.
    const baseSize = frame?.fontSize ?? style?.fontSize ?? 13;
    const family = frame?.fontFamily || style?.fontFamily || "Inter";
    const baseWeight = frame?.fontWeight ?? style?.fontWeight ?? 400;
    const baseColor = normalizeHex(frame?.color || style?.color, "#111827");

    const lineHeight = Math.round(baseSize * 1.35);

    const pushWord = (word: string, marks: any) => {
      const fontSize = marks?.size ?? baseSize;
      const bold = marks?.bold ? 700 : baseWeight;
      const italic = marks?.italic ? "italic" : "normal";
      const fill = normalizeHex(marks?.color ?? baseColor, baseColor);
      const ff = (marks?.font || family) as string;
      const bg = marks?.bg || frame?.bg || null;
      const font = `${italic} ${bold} ${fontSize}px ${ff}`;
      const ww = measureText(word, font);
      if (word === "\n") {
        x = 0;
        y += lineHeight;
        return;
      }
      if (x + ww > w && x > 0) {
        x = 0;
        y += lineHeight;
      }
      segments.push({ x: x0 + x, y: y0 + y, text: word, fontSize, fontStyle: `${italic} ${bold}`, fill, fontFamily: ff, bg: bg ? String(bg) : undefined });
      x += ww;
    };

    for (const run of runs) {
      const parts = run.text.split(/(\s+)/);
      for (const p of parts) {
        if (!p) continue;
        if (p.includes("\n")) {
          const sub = p.split("\n");
          sub.forEach((s, idx) => {
            if (s) pushWord(s, run.marks || {});
            if (idx < sub.length - 1) pushWord("\n", run.marks || {});
          });
          continue;
        }
        pushWord(p, run.marks || {});
      }
    }

    return segments;
  };

  const renderItem = (it: any, lockedLayer: boolean, layerMeta?: { id?: string; name?: string }) => {
    const isDetectedLayer = !!(layerMeta && (layerMeta.id === "overlay" || String(layerMeta.name || "").toLowerCase().includes("detectado")));
    if (isDetectedLayer) {
      if (it.type === "TextFrame" && !detectTextByPage[pageIndex]) return null;
      if (it.type === "ImageFrame" && !detectImagesByPage[pageIndex]) return null;
    }
    const id = it.id;
    const r = it.rect || { x: 0, y: 0, w: 10, h: 10 };
    const locked = lockedLayer || it.locked === true || it.type === "LockedLogoStamp";

    if (it.type === "Shape") {
      return (
        <Rect
          key={id}
          id={id}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          fill={it.fill || "#eef2ff"}
          draggable={!locked}
          onClick={() => !locked && setSelectedId(id)}
          onTap={() => !locked && setSelectedId(id)}
          onDragEnd={(e) => updateItemRect(id, { x: e.target.x(), y: e.target.y() })}
        />
      );
    }

    if (it.type === "ImageFrame") {
      const refStr = it.assetRef ? String(it.assetRef) : "";
      const url =
        refStr && refStr.startsWith("{{")
          ? null
          : refStr && refStr.startsWith("data:")
            ? refStr
            : refStr
              ? assetFileUrl(refStr)
              : null;

      // Locked logo stamp uses club locked_logo_asset_id
      const finalUrl = it.role === "locked_logo" && club?.locked_logo_asset_id
        ? assetFileUrl(String(club.locked_logo_asset_id))
        : url;

      const img = finalUrl ? imgMap[finalUrl] : null;

      // background items should not be draggable; selection via button
      const isBg = it.role === "pdf_background" || it.role === "page_background";

      return (
        <Group
          key={id}
          id={id}
          x={r.x}
          y={r.y}
          // Give the Group explicit dimensions so Transformer behaves correctly.
          // Without this, Konva Group reports width/height as 0 and resizing can
          // appear to "snap" back to the min size.
          width={r.w}
          height={r.h}
          draggable={!locked && !isBg && !isDetectedLayer}
          onClick={() => {
            if (locked || isBg) return;
            // Detected layers are selectable; conversion to editable is done from Inspector
            setSelectedId(id);
          }}
          onTap={() => {
            if (locked || isBg) return;
            setSelectedId(id);
          }}
          onDragEnd={(e) => updateItemRect(id, { x: e.target.x(), y: e.target.y() })}
        >
          <Rect width={r.w} height={r.h} fill={isBg ? "#0b1220" : "#eef2ff"} opacity={it.opacity ?? 1} />
          {img ? <KImage image={img} width={r.w} height={r.h} opacity={it.opacity ?? 1} /> : null}
          {!img && !isBg ? (
            <Text text="Imagen" x={10} y={10} fontSize={14} fill="#64748b" />
          ) : null}
        </Group>
      );
    }

    if (it.type === "TextFrame") {
      const style = doc?.styles?.textStyles?.[it.styleRef || "Body"] || doc?.styles?.textStyles?.Body || {};
      const segments = buildTextSegments(it, style);
      return (
        <Group
          key={id}
          id={id}
          x={it.rect.x}
          y={it.rect.y}
          draggable={!locked}
          onClick={() => {
            if (locked) return;
            setSelectedId(id);
          }}
          onTap={() => {
            if (locked) return;
            setSelectedId(id);
          }}
          onDblClick={() => {
            if (locked) return;
            openRichText(id);
          }}
          onDragEnd={(e) => updateItemRect(id, { x: e.target.x(), y: e.target.y() })}
        >
          <Rect
            x={0}
            y={0}
            width={it.rect.w}
            height={it.rect.h}
            fill={it.bg || "rgba(255,255,255,0)"}
            stroke={selectedId === id ? "rgba(91,140,255,.8)" : "rgba(0,0,0,0.08)"}
            strokeWidth={selectedId === id ? 2 : 1}
          />
          {segments.slice(0, 800).map((s, idx) => (
            <React.Fragment key={idx}>
              {s.bg ? (
                <Rect
                  x={s.x}
                  y={s.y}
                  width={Math.max(1, measureText(s.text, `${s.fontStyle} ${s.fontSize}px ${s.fontFamily}`))}
                  height={Math.round(s.fontSize * 1.35)}
                  fill={String(s.bg)}
                  opacity={0.9}
                  listening={false}
                />
              ) : null}
              <Text
                x={s.x}
                y={s.y}
                text={s.text}
                fontSize={s.fontSize}
                fontFamily={s.fontFamily}
                fill={s.fill}
                fontStyle={s.fontStyle}
                listening={false}
              />
            </React.Fragment>
          ))}
        </Group>
      );
    }

    if (it.type === "LockedLogoStamp") {
      // rendered as ImageFrame path
      const finalUrl = club?.locked_logo_asset_id ? assetFileUrl(String(club.locked_logo_asset_id)) : null;
      const img = finalUrl ? imgMap[finalUrl] : null;
      return (
        <Group key={id} id={id} x={r.x} y={r.y}>
          <Rect width={r.w} height={r.h} fill="rgba(255,255,255,.75)" />
          {img ? <KImage image={img} width={r.w} height={r.h} /> : <Text text="LOGO" x={18} y={40} fontSize={18} fill="#111" />}
        </Group>
      );
    }

    return null;
  };

  const selectedRef = selectedId ? findItem(selectedId) : null;
  const selected = selectedRef?.it || null;
  const selectedIsDetected = !!selectedRef?.layer?.id?.includes("detected");

  const scale = zoom;

  return (
    <div className="layout">
      {/* Left Sidebar */}
      <div className="sidebar left">
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 950 }}>{project?.name || "Proyecto"}</div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>A4 · spreads · {doc?.pages?.length || 0} páginas</div>
            </div>
            <button className="btn" onClick={() => nav("/")}>Salir</button>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button className="btn" onClick={save}>Guardar</button>
            <button className="btn primary" onClick={() => exportPdf("web")}>Export WEB</button>
            <button className="btn primary" onClick={() => exportPdf("print")}>Export IMPRENTA</button>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Detección (PDF importado)</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className={"btn" + (detectTextByPage[pageIndex] ? " primary" : "")}
                onClick={async () => {
                  const next = !detectTextByPage[pageIndex];
                  if (next) await ensureDetectedForPage(pageIndex);
                  setDetectTextByPage((m) => ({ ...m, [pageIndex]: next }));
                }}
                title="Mostrar/ocultar cajas de texto detectado"
              >
                Texto
              </button>
              <button
                className={"btn" + (detectImagesByPage[pageIndex] ? " primary" : "")}
                onClick={async () => {
                  const next = !detectImagesByPage[pageIndex];
                  if (next) await ensureDetectedForPage(pageIndex);
                  setDetectImagesByPage((m) => ({ ...m, [pageIndex]: next }));
                }}
                title="Mostrar/ocultar imágenes detectadas"
              >
                Imágenes
              </button>
              <button
                className="btn"
                onClick={() => {
                  setDetectTextByPage((m) => ({ ...m, [pageIndex]: true }));
                  setDetectImagesByPage((m) => ({ ...m, [pageIndex]: true }));
                }}
                title="Activar texto + imágenes"
              >
                Activar ambos
              </button>
              <button
                className="btn"
                onClick={() => {
                  setDetectTextByPage((m) => ({ ...m, [pageIndex]: false }));
                  setDetectImagesByPage((m) => ({ ...m, [pageIndex]: false }));
                }}
                title="Ocultar todo lo detectado"
              >
                Ocultar
              </button>
            </div>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Modo editor</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className={"btn" + (editorMode === "simple" ? " primary" : "")}
                onClick={() => setEditorMode("simple")}
                title="Modo SIMPLE (tipo Canva)"
              >
                SIMPLE
              </button>
              <button
                className={"btn" + (editorMode === "pro" ? " primary" : "")}
                onClick={() => setEditorMode("pro")}
                title="Modo PRO (texto con estilos por palabra)"
              >
                PRO
              </button>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <div style={{ fontWeight: 950 }}>Acciones</div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button className="btn" onClick={addTextFrame}>+ Texto</button>
            <button className="btn" onClick={() => fileInputRef.current?.click()}>+ Imagen</button>
            <button className="btn" onClick={addBlankPage}>+ Página</button>
            <button className="btn" onClick={addSponsorsPage}>+ Sponsors</button>
            <button className="btn" onClick={duplicatePage}>Duplicar página</button>
            <button className="btn" onClick={() => bgFileInputRef.current?.click()}>Cambiar fondo</button>
            <button className="btn" onClick={selectBackgroundItem}>Seleccionar fondo</button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickImage(f);
              (e.target as any).value = "";
            }}
          />
          <input
            ref={bgFileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickBackground(f);
              (e.target as any).value = "";
            }}
          />
        </div>

        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 950 }}>Página</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => setPageIndex(Math.max(0, safePageIndex - 1))}>◀</button>
              <button className="btn" onClick={() => setPageIndex(Math.min((doc?.pages?.length || 1) - 1, safePageIndex + 1))}>▶</button>
            </div>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
            <select
              value={safePageIndex}
              onChange={(e) => setPageIndex(parseInt(e.target.value, 10))}
              style={{
                width: "100%",
                height: 40,
                borderRadius: 14,
                border: "1px solid var(--border)",
                // Solid background so text is always readable over dark UI
                background: "#f3f4f6",
                color: "#111827",
              }}
            >
              {(doc?.pages || []).map((_: any, idx: number) => (
                <option key={idx} value={idx}>Página {idx + 1}</option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Zoom</div>
            <input
              style={{ width: "100%" }}
              type="range"
              min={0.5}
              max={1.6}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
            />
            <div style={{ width: 44, textAlign: "right", fontSize: 12, color: "var(--muted)" }}>{Math.round(zoom * 100)}%</div>
          </div>
        </div>
      </div>

      {/* Main Canvas */}
      <div className="main">
        <div className="card" style={{ display: "inline-block", padding: 14, background: "rgba(255,255,255,.02)" }}>
          <div
            style={{
              width: A4_W * scale,
              height: A4_H * scale,
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: "0 30px 90px rgba(0,0,0,.45)",
            }}
          >
            <Stage
              width={A4_W}
              height={A4_H}
              scaleX={scale}
              scaleY={scale}
              ref={stageRef}
              onMouseDown={(e) => {
                const clickedOnEmpty = e.target === e.target.getStage();
                if (clickedOnEmpty) setSelectedId(null);
              }}
            >
              {(page?.layers || [])
                .filter((layer: any) => {
                  const lid = String(layer?.id || "");
                  if (lid === "detected_text") return !!detectTextByPage[safePageIndex];
                  if (lid === "detected_images") return !!detectImagesByPage[safePageIndex];
                  return true;
                })
                .map((layer: any) => (
                  <Layer key={layer.id}>
                    {(layer.items || []).map((it: any) =>
                      renderItem(it, layer.locked === true, { id: layer.id, name: layer.name })
                    )}
                  </Layer>
                ))}
              <Layer>
                <Transformer
                  ref={trRef}
                  rotateEnabled={true}
                  keepRatio={false}
                  enabledAnchors={[
                    "top-left",
                    "top-center",
                    "top-right",
                    "middle-left",
                    "middle-right",
                    "bottom-left",
                    "bottom-center",
                    "bottom-right",
                  ]}
                  boundBoxFunc={(oldBox, newBox) => {
                    if (newBox.width < 20 || newBox.height < 20) return oldBox;
                    return newBox;
                  }}
                  onTransformEnd={() => {
                    const stage = stageRef.current;
                    const node = stage?.findOne?.(`#${selectedId}`);
                    if (!node || !selectedId) return;
                    const sx = node.scaleX();
                    const sy = node.scaleY();

                    // IMPORTANT: Konva Group nodes don't always have a stable width()/height().
                    // Persist size based on the document rect instead of node.width(), otherwise
                    // some elements may "snap" back after resizing.
                    const it = findItem(selectedId)?.it;
                    const baseW = Math.max(20, Number(it?.rect?.w || 0));
                    const baseH = Math.max(20, Number(it?.rect?.h || 0));

                    // Persist resize in document units (independent of Stage zoom).
                    // We render ImageFrame/TextFrame as Groups but we also assign
                    // them explicit width/height, so we can safely use node.width/height.
                    // Using getClientRect here would include Stage scaling and can
                    // make elements "snap" smaller after resize.
                    const newW = Math.max(20, baseW * sx);
                    const newH = Math.max(20, baseH * sy);

                    node.scaleX(1);
                    node.scaleY(1);
                    updateItemRect(selectedId, {
                      x: node.x(),
                      y: node.y(),
                      w: newW,
                      h: newH,
                    });
                  }}
                />
              </Layer>
            </Stage>
          </div>
        </div>
      </div>

      {/* Right Inspector */}
      <div className="sidebar right" style={{ width: 360 }}>
        <div className="card">
          <div style={{ fontWeight: 950, marginBottom: 8 }}>Inspector</div>
          {!selected ? (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>Selecciona un elemento para editar.</div>
          ) : (
            <>
              <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10 }}>
                {selected.type} · id {selected.id}
              </div>

              {"rect" in selected && (
                <div className="field">
                  <label>Posición / Tamaño</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {["x", "y", "w", "h"].map((k) => (
                      <input
                        key={k}
                        type="number"
                        value={Math.round((selected.rect?.[k] || 0) * 10) / 10}
                        onChange={(e) => updateItemRect(selected.id, { [k]: parseFloat(e.target.value) })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {selected.type === "TextFrame" && (
                <>
                  <div className="field">
                    <label>Estilo</label>
                    <select value={selected.styleRef || "Body"} onChange={(e) => updateItem(selected.id, { styleRef: e.target.value })}>
                      {Object.keys(doc?.styles?.textStyles || { Body: true }).map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Fuente</label>
                    <select
                      value={selected.fontFamily || "Inter"}
                      onChange={(e) => updateItem(selected.id, { fontFamily: e.target.value })}
                    >
                      {FONT_OPTIONS.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div className="field">
                      <label>Tamaño</label>
                      <input
                        type="number"
                        min={6}
                        max={120}
                        value={selected.fontSize || doc?.styles?.textStyles?.[selected.styleRef || "Body"]?.fontSize || 13}
                        onChange={(e) => updateItem(selected.id, { fontSize: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="field">
                      <label>Color</label>
                      <input
                        type="color"
                        value={normalizeHex(selected.color || doc?.styles?.textStyles?.[selected.styleRef || "Body"]?.color, "#111827")}
                        onChange={(e) => updateItem(selected.id, { color: e.target.value })}
                      />
                    </div>
                  </div>
                  {editorMode === "simple" ? (
                    <>
                      <div className="field">
                        <label>Texto (SIMPLE)</label>
                        <textarea
                          value={simpleText}
                          onChange={(e) => setSimpleText(e.target.value)}
                          style={{
                            minHeight: 120,
                            resize: "vertical",
                            borderRadius: 14,
                            border: "1px solid var(--border)",
                            background: "#f3f4f6",
                            color: "#111827",
                            padding: 12,
                            outline: "none",
                            lineHeight: 1.35,
                          }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <button className="btn primary" onClick={applySimpleText}>Aplicar texto</button>
                        <button className="btn" onClick={() => applyTextBg(true)}>Fondo texto</button>
                        <button className="btn" onClick={() => applyTextBg(false)}>Sin fondo</button>
                        <input type="color" value={textBgHex} onChange={(e) => setTextBgHex(e.target.value)} title="Color fondo" />
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={textBgA}
                          onChange={(e) => setTextBgA(parseFloat(e.target.value))}
                          title="Opacidad fondo"
                        />
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <button
                        className="btn primary"
                        onClick={() => openRichText(selected.id)}
                        title="Editor PRO en panel derecho (no tapa la revista)"
                      >
                        Editor PRO (panel)
                      </button>
                      <button className="btn" onClick={() => applyTextBg(true)}>Fondo texto</button>
                      <button className="btn" onClick={() => applyTextBg(false)}>Sin fondo</button>
                      <input type="color" value={textBgHex} onChange={(e) => setTextBgHex(e.target.value)} title="Color fondo" />
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={textBgA}
                        onChange={(e) => setTextBgA(parseFloat(e.target.value))}
                        title="Opacidad fondo"
                      />
                      {/* PRO tools are always available */}
                    </div>
                  )}
                </>
              )}

              {selected.type === "ImageFrame" && (
                <>
                  <div className="field">
                    <label>Ajuste imagen</label>
                    <select value={selected.fitMode || "cover"} onChange={(e) => updateItem(selected.id, { fitMode: e.target.value })}>
                      <option value="cover">Cover</option>
                      <option value="contain">Contain</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button className="btn" onClick={() => fileInputRef.current?.click()}>Reemplazar imagen</button>
                  </div>
                </>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                {selectedIsDetected && (
                  <button className="btn" onClick={() => promoteDetectedItem(selected.id)}>
                    Convertir a editable
                  </button>
                )}
                <button
                  className="btn"
                  onClick={() => {
                    // delete selected (except locked)
                    const f = findItem(selected.id);
                    if (!f) return;
                    if (selected.role === "locked_logo") return showToast("Logo bloqueado");
                    if (selected.role === "pdf_background" || selected.role === "page_background") return showToast("Usa 'Cambiar fondo'");
                    setDoc((prev: any) => {
                      const next = safeClone(prev);
                      const p = next.pages[safePageIndex];
                      for (const l of p.layers || []) {
                        l.items = (l.items || []).filter((it: any) => it.id !== selected.id);
                      }
                      return next;
                    });
                    setSelectedId(null);
                    showToast("Eliminado");
                  }}
                >
                  Eliminar
                </button>
              </div>
            </>
          )}
        </div>

        {/* Option A: PRO text editor as right-side panel (non-modal) */}
        {editorMode === "pro" && (
          <div className="card" style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 950 }}>Editor PRO</div>
              {/* always visible */}
            </div>

            {!rtTargetId ? (
              <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 10 }}>
                Selecciona un texto y pulsa <b>Editor PRO (panel)</b>.
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                  <button className="btn" onClick={() => document.execCommand("bold")}>Negrita</button>
                  <button className="btn" onClick={() => document.execCommand("italic")}>Cursiva</button>
                  <button className="btn" onClick={() => document.execCommand("underline")}>Subrayado</button>
                  <select
                    defaultValue={""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) document.execCommand("fontName", false, v);
                    }}
                    title="Fuente"
                  >
                    <option value="">Fuente…</option>
                    {FONT_OPTIONS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  <input
                    type="color"
                    onChange={(e) => document.execCommand("foreColor", false, e.target.value)}
                    title="Color"
                  />
                  <input
                    type="color"
                    onChange={(e) => {
                      // Some browsers use "hiliteColor", others "backColor".
                      const c = e.target.value;
                      try { document.execCommand("hiliteColor", false, c); } catch { /* ignore */ }
                      try { document.execCommand("backColor", false, c); } catch { /* ignore */ }
                    }}
                    title="Fondo"
                  />
                  <select onChange={(e) => document.execCommand("fontSize", false, e.target.value)}>
                    <option value="3">12–14</option>
                    <option value="4">16</option>
                    <option value="5">18</option>
                    <option value="6">24</option>
                    <option value="7">32</option>
                  </select>
                  <div style={{ flex: 1 }} />
                  <button className="btn primary" onClick={saveRichText}>Aplicar</button>
                </div>

                <div
                  ref={rtDivRef}
                  contentEditable
                  suppressContentEditableWarning
                  style={{
                    marginTop: 12,
                    minHeight: 220,
                    padding: 14,
                    borderRadius: 16,
                    border: "1px solid var(--border)",
                    // Solid background so it is readable and not "transparent"
                    background: "#f3f4f6",
                    color: "#111827",
                    outline: "none",
                    lineHeight: 1.4,
                    whiteSpace: "pre-wrap",
                    overflow: "auto",
                  }}
                  onInput={() => setRtHtml(rtDivRef.current?.innerHTML || "")}
                />

                <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 10 }}>
                  Tip: puedes mezclar estilos dentro de una misma frase. Los tokens como <b>{"{{club.name}}"}</b> se mantienen.
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Option A uses the right-side panel, no modal */}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

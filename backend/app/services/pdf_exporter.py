from __future__ import annotations
from typing import Any, Dict, Optional
import io
import uuid
import base64
import fitz
from sqlalchemy.orm import Session

from app.models.models import Asset
from app.services.storage import get_local_path

A4_W, A4_H = 595.2756, 841.8898

def _hex_to_rgb(hex_color: str):
    h = (hex_color or "").strip()
    if h.startswith("rgba"):
        # crude rgba(r,g,b,a)
        try:
            inside = h[h.find("(")+1:h.find(")")]
            r,g,b,_a = [x.strip() for x in inside.split(",")]
            return (int(r)/255, int(g)/255, int(b)/255)
        except Exception:
            return (0,0,0)
    if not h.startswith("#"):
        return (0,0,0)
    h = h[1:]
    if len(h) == 3:
        h = "".join([c+c for c in h])
    try:
        r = int(h[0:2],16)/255
        g = int(h[2:4],16)/255
        b = int(h[4:6],16)/255
        return (r,g,b)
    except Exception:
        return (0,0,0)

def resolve_asset_path(db: Session, asset_ref: Optional[str]) -> Optional[str]:
    if not asset_ref or str(asset_ref).startswith("{{"):
        return None
    a = db.get(Asset, str(asset_ref))
    if a:
        try:
            return get_local_path(a.storage_path)
        except Exception:
            return None
    # backward compat: allow raw path
    try:
        return get_local_path(str(asset_ref))
    except Exception:
        return None

def export_document_to_pdf(
    db: Session,
    document: Dict[str, Any],
    quality: str = "web",
    watermark: bool = False,
) -> bytes:
    doc = fitz.open()
    pages = document.get("pages") or []
    styles = (document.get("styles") or {}).get("textStyles") or {}
    for p in pages:
        page = doc.new_page(width=A4_W, height=A4_H)
        # render in layer order
        for layer in (p.get("layers") or []):
            for it in (layer.get("items") or []):
                t = it.get("type")
                r = it.get("rect") or {}
                rect = fitz.Rect(r.get("x",0), r.get("y",0), r.get("x",0)+r.get("w",10), r.get("y",0)+r.get("h",10))
                if t == "Shape":
                    fill = _hex_to_rgb(it.get("fill") or "#eef2ff")
                    page.draw_rect(rect, color=None, fill=fill, width=0)
                elif t == "ImageFrame":
                    asset_ref = it.get("assetRef")
                    # Support embedded placeholder images (data URI) for templates.
                    if isinstance(asset_ref, str) and asset_ref.startswith("data:image/png;base64,"):
                        try:
                            b64 = asset_ref.split(",", 1)[1]
                            img_bytes = base64.b64decode(b64)
                            page.insert_image(rect, stream=img_bytes, keep_proportion=False)
                        except Exception:
                            pass
                        continue

                    path = resolve_asset_path(db, asset_ref)
                    if not path:
                        continue
                    try:
                        page.insert_image(rect, filename=path, keep_proportion=False)
                    except Exception:
                        continue
                elif t == "TextFrame":
                    style = styles.get(it.get("styleRef") or "Body") or styles.get("Body") or {}
                    # Allow per-item overrides (so editor changes affect export).
                    font_size = float(it.get("fontSize") or style.get("fontSize") or 13)
                    color = _hex_to_rgb(it.get("color") or style.get("color") or "#111827")
                    # Optional background fill for the text frame.
                    bg = it.get("bg")
                    if bg and isinstance(bg, str) and bg not in ("transparent", "rgba(0,0,0,0)"):
                        try:
                            page.draw_rect(rect, color=None, fill=_hex_to_rgb(bg), width=0)
                        except Exception:
                            pass

                    # Map common font families to built-in PDF fonts.
                    fam = str(it.get("fontFamily") or style.get("fontFamily") or "")
                    fam_l = fam.lower()
                    if "cour" in fam_l:
                        fontname = "cour"
                    elif "times" in fam_l or "serif" in fam_l or "playfair" in fam_l:
                        # Built-in PDF font
                        fontname = "times"
                    else:
                        fontname = "helv"
                    # Guard against invalid/empty rects and excessive padding.
                    padding = float(it.get("padding") or 8)
                    try:
                        w = float(rect.width)
                        h = float(rect.height)
                    except Exception:
                        continue

                    # Ensure padding doesn't invert the rectangle.
                    max_pad_x = max(0.0, (w - 2.0) / 2.0)
                    max_pad_y = max(0.0, (h - 2.0) / 2.0)
                    pad = min(padding, max_pad_x, max_pad_y)
                    rr = fitz.Rect(rect.x0 + pad, rect.y0 + pad, rect.x1 - pad, rect.y1 - pad)
                    runs = it.get("text")
                    if isinstance(runs, list):
                        text = "".join([x.get("text","") for x in runs])
                    else:
                        text = str(runs or "")
                    # basic
                    if not text.strip():
                        continue
                    # PyMuPDF raises if the textbox is empty/invalid.
                    if rr.is_empty or (rr.x1 <= rr.x0) or (rr.y1 <= rr.y0):
                        continue
                    page.insert_textbox(rr, text, fontsize=font_size, color=color, fontname=fontname, align=0)
                elif t == "LockedLogoStamp":
                    # resolved at frontend; backend includes if club locked logo stored as assetRef in doc variables; ignored in V10.3.1 export.
                    pass

        if watermark:
            wm_rect = fitz.Rect(40, A4_H/2-40, A4_W-40, A4_H/2+40)
            # PyMuPDF only allows rotate in multiples of 90 for insert_textbox.
            # Keep watermark simple and robust (no crash on export).
            page.insert_textbox(wm_rect, "VISTA PREVIA · UPGRADE A PRO", fontsize=34, color=(0.7,0.7,0.7), align=1)
            # Add a subtle page tint WITHOUT relying on opacity params (not supported in some PyMuPDF builds).
            # Try newer keyword first; fall back to a very light gray fill.
            try:
                page.draw_rect(fitz.Rect(0, 0, A4_W, A4_H), color=None, fill=(0, 0, 0), fill_opacity=0.03, width=0)
            except TypeError:
                page.draw_rect(fitz.Rect(0, 0, A4_W, A4_H), color=None, fill=(0.97, 0.97, 0.97), width=0)

    # Quality: for now, keep vector. (Images come as-is.)
    out = doc.tobytes(deflate=True, garbage=4, clean=True)
    doc.close()
    return out

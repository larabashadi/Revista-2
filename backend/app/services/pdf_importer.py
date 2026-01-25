from __future__ import annotations
from typing import Dict, Any, List, Tuple
import uuid
import fitz
from sqlalchemy.orm import Session

from app.models.models import Asset
from app.services.storage import save_local_file

A4_W, A4_H = 595.2756, 841.8898

def _int_to_hex_rgb(c: int) -> str:
    # PyMuPDF span color is usually 0xRRGGBB.
    try:
        r = (c >> 16) & 255
        g = (c >> 8) & 255
        b = c & 255
        return f"#{r:02x}{g:02x}{b:02x}"
    except Exception:
        return "#111827"


def _sample_solid_bg_hex(pix: fitz.Pixmap, bbox: fitz.Rect, page_w: float, page_h: float) -> str | None:
    """Best-effort detection of a solid background color behind a text bbox.

    We sample a small grid of pixels from a low-res pixmap. If the color variance
    is low, we assume it's a solid background (e.g., a colored label) and return
    its mean color as hex. Otherwise returns None.
    """
    try:
        if pix is None or pix.width <= 0 or pix.height <= 0:
            return None
        # Ignore tiny boxes
        if (bbox.x1 - bbox.x0) * (bbox.y1 - bbox.y0) < 400:  # in PDF points^2
            return None
        # Map PDF coords -> pix coords
        x0 = max(0, min(pix.width - 1, int(bbox.x0 / page_w * pix.width)))
        x1 = max(0, min(pix.width, int(bbox.x1 / page_w * pix.width)))
        y0 = max(0, min(pix.height - 1, int(bbox.y0 / page_h * pix.height)))
        y1 = max(0, min(pix.height, int(bbox.y1 / page_h * pix.height)))
        if x1 - x0 < 6 or y1 - y0 < 6:
            return None

        # Sample a 5x5 grid inside the bbox (avoid borders)
        samples: List[Tuple[int, int, int]] = []
        for gy in range(5):
            for gx in range(5):
                xx = x0 + int((gx + 1) / 6 * (x1 - x0))
                yy = y0 + int((gy + 1) / 6 * (y1 - y0))
                # pix.samples is bytes in RGB/RGBA order
                idx = (yy * pix.width + xx) * pix.n
                r = pix.samples[idx + 0]
                g = pix.samples[idx + 1]
                b = pix.samples[idx + 2]
                samples.append((r, g, b))

        mr = sum(s[0] for s in samples) / len(samples)
        mg = sum(s[1] for s in samples) / len(samples)
        mb = sum(s[2] for s in samples) / len(samples)
        # Variance as mean absolute deviation
        dev = sum(abs(s[0] - mr) + abs(s[1] - mg) + abs(s[2] - mb) for s in samples) / len(samples)
        if dev > 18:  # heuristic threshold
            return None
        return f"#{int(mr):02x}{int(mg):02x}{int(mb):02x}"
    except Exception:
        return None

def _render_page_image(doc: fitz.Document, page_index: int, scale: float=2.0) -> bytes:
    page = doc.load_page(page_index)
    mat = fitz.Matrix(scale, scale)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    return pix.tobytes("png")

def _map_rect(r: fitz.Rect, page_w: float, page_h: float):
    sx = A4_W / page_w
    sy = A4_H / page_h
    return {"x": float(r.x0 * sx), "y": float(r.y0 * sy), "w": float((r.x1 - r.x0) * sx), "h": float((r.y1 - r.y0) * sy)}

def _mk_asset(db: Session, club_id: str, png_bytes: bytes, base_name: str) -> str:
    # Use the same id on disk and in the DB so every pipeline (editor, exporter, importer) can resolve assets reliably.
    asset_id, _path = save_local_file(png_bytes, f"{base_name}.png")
    db.add(Asset(id=asset_id, club_id=club_id, filename=f"{base_name}.png", mime="image/png", storage_path=asset_id, is_catalog=False))
    return asset_id

def import_pdf_to_document(db: Session, club_id: str, pdf_bytes: bytes, mode: str="safe", preset: str="smart") -> Tuple[Dict[str, Any], List[str]]:
    """Import PDF into native-ish document.

    - Always creates a background raster of each page (safe mode).
    - Extracts text blocks into editable TextFrames.
    - Extracts embedded images into ImageFrames when possible.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages=[]
    created_asset_ids: List[str] = []

    for i in range(doc.page_count):
        page = doc.load_page(i)
        page_w, page_h = float(page.rect.width), float(page.rect.height)

        pix_low: fitz.Pixmap | None = None
        if preset in ("smart", "text", "pro"):
            try:
                # Low-res raster used only to guess solid backgrounds behind text blocks.
                pix_low = page.get_pixmap(matrix=fitz.Matrix(0.5, 0.5), alpha=False)
            except Exception:
                pix_low = None

        # Background raster
        bg_png = _render_page_image(doc, i, scale=2.0)
        bg_asset_id = _mk_asset(db, club_id, bg_png, f"import_bg_p{i+1}")
        created_asset_ids.append(bg_asset_id)

        bg_item = {
            "id": f"bg-{i}",
            "type":"ImageFrame",
            "rect":{"x":0,"y":0,"w":A4_W,"h":A4_H},
            "assetRef": bg_asset_id,
            "fitMode":"cover",
            "crop":{"x":0,"y":0,"w":1,"h":1},
            "locked": True,
            "role":"pdf_background"
        }

        overlay_items: List[Dict[str,Any]] = []

        # Text extraction
        try:
            td = page.get_text("dict")
            for b in td.get("blocks", []):
                if b.get("type") != 0:
                    continue
                # block bbox
                x0,y0,x1,y1 = b.get("bbox", [0,0,0,0])
                rect = _map_rect(fitz.Rect(x0,y0,x1,y1), page_w, page_h)
                # build rich text runs preserving basic styles from spans
                runs: List[Dict[str,Any]] = []
                for li, ln in enumerate(b.get("lines", [])):
                    for sp in ln.get("spans", []):
                        t = sp.get("text","")
                        if not t:
                            continue
                        marks: Dict[str,Any] = {}
                        # Size + color + font
                        try:
                            marks["size"] = float(sp.get("size", 13))
                        except Exception:
                            pass
                        col = sp.get("color")
                        if isinstance(col, int):
                            marks["color"] = _int_to_hex_rgb(col)
                        fn = (sp.get("font") or "").strip()
                        if fn:
                            marks["font"] = fn
                        # Flags may encode bold/italic
                        flags = sp.get("flags")
                        if isinstance(flags, int):
                            if flags & 16:
                                marks["bold"] = True
                            if flags & 2:
                                marks["italic"] = True
                        runs.append({"text": t, "marks": marks})
                    if li < len(b.get("lines", [])) - 1:
                        runs.append({"text": "\n", "marks": {}})
                # Compact: if all runs empty or whitespace, skip
                plain = "".join([r.get("text","") for r in runs]).strip()
                if not plain:
                    continue

                # Try to detect a solid background color behind this text block
                bg_hex: str | None = None
                if pix_low is not None:
                    try:
                        bg_hex = _sample_solid_bg_hex(pix_low, fitz.Rect(x0, y0, x1, y1), page_w, page_h)
                    except Exception:
                        bg_hex = None
                if bg_hex:
                    for r in runs:
                        # Only set default bg if the run doesn't already have one.
                        if isinstance(r, dict):
                            marks = r.get("marks") or {}
                            if "bg" not in marks:
                                marks["bg"] = bg_hex
                                r["marks"] = marks

                overlay_items.append({
                    "id": f"tx-{i}-{len(overlay_items)}",
                    "type":"TextFrame",
                    "rect": rect,
                    "text": runs,
                    "styleRef":"Body",
                    "padding": 6,
                    **({"bg": bg_hex} if bg_hex else {}),
                })
        except Exception:
            pass

        # Image extraction (embedded)
        try:
            imgs = page.get_images(full=True)
            seen=set()
            for img in imgs:
                xref = img[0]
                if xref in seen:
                    continue
                seen.add(xref)
                rects = page.get_image_rects(xref)
                if not rects:
                    continue
                raw = doc.extract_image(xref)
                im_bytes = raw.get("image")
                if not im_bytes:
                    continue
                # Convert to PNG via pixmap for consistency
                try:
                    pix = fitz.Pixmap(doc, xref)
                    if pix.n >= 5:  # CMYK etc
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                    im_bytes = pix.tobytes("png")
                except Exception:
                    pass
                asset_id = _mk_asset(db, club_id, im_bytes, f"import_img_{i+1}_{xref}")
                created_asset_ids.append(asset_id)
                for r in rects[:4]:
                    rr = _map_rect(r, page_w, page_h)
                    if rr["w"] < 10 or rr["h"] < 10:
                        continue
                    overlay_items.append({
                        "id": f"im-{i}-{xref}-{len(overlay_items)}",
                        "type":"ImageFrame",
                        "rect": rr,
                        "assetRef": asset_id,
                        "fitMode":"cover",
                        "crop":{"x":0,"y":0,"w":1,"h":1},
                        "role":"imported_image",
                    })
        except Exception:
            pass

        # Layers: background locked, overlay editable
        # IMPORTANT UX: detection overlays are OFF by default.
        # The editor can toggle detected text / images on demand.
        layers=[
            {"id":"bg","name":"PDF Fondo","visible":True,"locked":True,"items":[bg_item]},
            {"id":"overlay","name":"Detectado","visible":False,"locked":False,"items":overlay_items},
        ]
        pages.append({"id": f"p-{i}", "sectionType":"Imported", "layers": layers})

    out_doc = {
        "id": str(uuid.uuid4()),
        "format":"A4",
        "spreads": True,
        "settings":{"marginsMirror": True, "bleedMm":3, "cropMarks": True, "colorMode":"RGB"},
        "styles": {
            "textStyles":{
                "H1":{"fontFamily":"Inter","fontSize":40,"fontWeight":800,"color":"#0f172a"},
                "H2":{"fontFamily":"Inter","fontSize":26,"fontWeight":750,"color":"#0f172a"},
                "Body":{"fontFamily":"Inter","fontSize":13,"fontWeight":450,"color":"#111827"},
                "Caption":{"fontFamily":"Inter","fontSize":11,"fontWeight":500,"color":"#64748b"},
            },
            "colorTokens":{"accent":"#5b8cff","ink":"#0f172a"}
        },
        "pages": pages,
        "componentsLibrary": [],
        "variables": {},
        "generator": {"version":"import-v2", "mode": mode, "preset": preset},
    }
    db.commit()
    return out_doc, created_asset_ids



def detect_pdf_page_overlays(db: Session, club_id: str, pdf_bytes: bytes, page_index: int) -> Dict[str, Any]:
    """
    Detect editable overlays for a single page of a source PDF:

    - Text: extracted from the PDF text layer (NOT OCR). Preserves line breaks and basic span styling.
    - Images: extracted from embedded images and saved as Assets so they can be replaced/moved in the editor.

    If the PDF is scanned (no real text layer), returns meta.ocr_needed=True and no text items.
    """
    d = fitz.open(stream=pdf_bytes, filetype="pdf")
    if page_index < 0 or page_index >= d.page_count:
        d.close()
        raise ValueError("page_index out of range")

    page = d.load_page(page_index)
    page_w, page_h = float(page.rect.width), float(page.rect.height)

    def map_rect(rr: fitz.Rect) -> Dict[str, float]:
        return _map_rect(rr, page_w, page_h)

    # --- TEXT ---
    out_text: List[Dict[str, Any]] = []

    # rawdict keeps text more faithfully than dict for many PDFs
    try:
        td = page.get_text("rawdict")
    except Exception:
        td = page.get_text("dict")

    blocks = td.get("blocks", []) if isinstance(td, dict) else []
    total_chars = 0
    total_printable = 0

    for b in blocks:
        if b.get("type") != 0:
            continue

        bbox = b.get("bbox", None)
        if not bbox or len(bbox) != 4:
            continue
        rect = fitz.Rect(bbox[0], bbox[1], bbox[2], bbox[3])

        runs: List[Dict[str, Any]] = []
        # Preserve line breaks: add "\n" between lines
        lines = b.get("lines", []) or []
        for li, ln in enumerate(lines):
            spans = ln.get("spans", []) or []
            for sp in spans:
                t = sp.get("text", "")
                if t is None:
                    continue
                # Keep as-is, do not .strip() to avoid "inventing" spacing
                if t == "":
                    continue

                # Stats for "scanned / garbage" detection
                total_chars += len(t)
                total_printable += sum(1 for ch in t if 32 <= ord(ch) <= 126 or ch in "\n\t" or ch.isalpha())

                marks: Dict[str, Any] = {}
                try:
                    marks["size"] = float(sp.get("size", 13))
                except Exception:
                    pass

                col = sp.get("color")
                if isinstance(col, int):
                    marks["color"] = _int_to_hex_rgb(col)
                fn = (sp.get("font") or "").strip()
                if fn:
                    marks["font"] = fn

                flags = sp.get("flags")
                if isinstance(flags, int):
                    # These are best-effort; PyMuPDF flags vary by producer
                    if flags & 16:
                        marks["bold"] = True
                    if flags & 2:
                        marks["italic"] = True

                runs.append({"text": t, "marks": marks})

            if li < len(lines) - 1:
                runs.append({"text": "\n", "marks": {}})

        plain = "".join([r.get("text", "") for r in runs]).strip()
        if not plain:
            continue

        out_text.append(
            {
                "id": str(uuid.uuid4()),
                "rect": map_rect(rect),
                "text": plain,
                "runs": runs,
                "color_hex": "#111827",
            }
        )

    # Heuristic: if extracted text looks like garbage / almost none, mark as OCR needed.
    ocr_needed = False
    if total_chars == 0:
        ocr_needed = True
        out_text = []
    else:
        ratio = (total_printable / max(1, total_chars))
        if ratio < 0.55 and total_chars > 50:
            # Many scanned PDFs produce weird non-printable output
            ocr_needed = True
            out_text = []

    # --- IMAGES ---
    out_images: List[Dict[str, Any]] = []
    seen_xref: set[int] = set()

    try:
        imgs = page.get_images(full=True)
    except Exception:
        imgs = []

    for img in imgs:
        xref = int(img[0])
        if xref in seen_xref:
            continue
        seen_xref.add(xref)

        try:
            rects = page.get_image_rects(xref)
        except Exception:
            rects = []

        if not rects:
            continue

        # Extract the actual image bytes and save as an Asset
        im_bytes = None
        try:
            pix = fitz.Pixmap(d, xref)
            if pix.n >= 5:
                pix = fitz.Pixmap(fitz.csRGB, pix)
            im_bytes = pix.tobytes("png")
        except Exception:
            try:
                raw = d.extract_image(xref)
                im_bytes = raw.get("image")
            except Exception:
                im_bytes = None

        asset_id = None
        if im_bytes:
            asset_id = _mk_asset(db, club_id, im_bytes, f"detect_img_p{page_index+1}_{xref}")

        for rr in rects[:8]:
            mapped = map_rect(rr)
            if mapped["w"] < 8 or mapped["h"] < 8:
                continue
            out_images.append(
                {
                    "id": str(uuid.uuid4()),
                    "rect": mapped,
                    "asset_id": asset_id,
                    "xref": xref,
                }
            )

    d.close()
    db.commit()
    return {"text": out_text, "images": out_images, "meta": {"ocr_needed": ocr_needed}}


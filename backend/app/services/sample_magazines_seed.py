from __future__ import annotations

"""Seed realistic magazine templates from bundled sample PDFs.

This project originally shipped with copyright-safe *synthetic* placeholders.
The user later provided their own example PDFs and asked that the catalog
templates look like real sports magazines.

Approach
--------
On first run, we:
1) Render each page of each bundled PDF to PNG.
2) Store each PNG as an Asset (catalog asset).
3) Create Templates that use those rendered images as locked page backgrounds,
   plus a few editable overlays (titles / subtitles / captions / sponsor slots).

This keeps the editor workflow simple: users can replace photos, edit text, add
pages, add sponsor grids, and export.
"""

import io
import json
import os
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

import fitz  # PyMuPDF
from sqlalchemy.orm import Session

from app.models.models import Asset, Template
from app.services.storage import save_local_file


A4_W, A4_H = 595.2756, 841.8898


@dataclass
class SamplePDF:
    name: str
    filename: str


SAMPLES: List[SamplePDF] = [
    SamplePDF("Oviedo Sport", "14_OVIEDO_SPORT_baja.pdf"),
    SamplePDF("Time Sport Leyendas", "17_TIME_SPORT_LEYENDASv2_baja_compressed.pdf"),
    SamplePDF("Time Sport Pontevedra", "16_TIME_SPORT_PONTEVEDRA_baja_compressed-1-1.pdf"),
    SamplePDF("Revista General", "RevistaGeneral.pdf"),
    SamplePDF("Revista 1", "REVISTA (1).pdf"),
    SamplePDF("Revista Doc", "REVISTA_13.11.25.doc.pdf"),
]


def _bundled_dir() -> str:
    # backend/app/services/.. -> backend/app
    base = os.path.dirname(os.path.dirname(__file__))
    return os.path.join(base, "sample_pdfs")


def _asset_exists(db: Session, filename: str) -> bool:
    return (
        db.query(Asset)
        .filter(Asset.is_catalog == True)  # noqa: E712
        .filter(Asset.filename == filename)
        .count()
        > 0
    )


def _add_asset(db: Session, content: bytes, filename: str) -> str:
    asset_id, _path = save_local_file(content, filename)
    a = Asset(
        id=asset_id,
        club_id=None,
        filename=filename,
        mime="image/png",
        storage_path=asset_id,
        is_catalog=True,
    )
    db.add(a)
    return asset_id


def _render_pdf_pages_to_assets(
    db: Session,
    pdf_path: str,
    *,
    prefix: str,
    max_pages: int = 40,
    zoom: float = 1.6,
) -> List[str]:
    """Render up to max_pages pages from pdf_path and store as catalog assets."""
    asset_ids: List[str] = []
    with fitz.open(pdf_path) as pdf:
        page_count = min(max_pages, pdf.page_count)
        mat = fitz.Matrix(zoom, zoom)
        for i in range(page_count):
            fname = f"sample-{prefix}-p{i+1:03d}.png"
            if _asset_exists(db, fname):
                # Reuse existing asset id
                a = (
                    db.query(Asset)
                    .filter(Asset.is_catalog == True)  # noqa: E712
                    .filter(Asset.filename == fname)
                    .first()
                )
                if a:
                    asset_ids.append(a.id)
                    continue
            page = pdf.load_page(i)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            png = pix.tobytes("png")
            aid = _add_asset(db, png, fname)
            asset_ids.append(aid)
    return asset_ids


def _build_template_document(
    *,
    name: str,
    bg_asset_ids: List[str],
    sport: str = "football",
) -> Dict[str, Any]:
    """Create a document with locked background images per page + editable overlays."""

    def bg_item(aid: str):
        return {
            "id": uuid.uuid4().hex,
            "type": "ImageFrame",
            "rect": {"x": 0, "y": 0, "w": A4_W, "h": A4_H},
            "assetRef": aid,
            "fitMode": "cover",
            "role": "page_background",
            "locked": True,
        }

    def headline():
        return {
            "id": uuid.uuid4().hex,
            "type": "TextFrame",
            "rect": {"x": 42, "y": 56, "w": A4_W - 84, "h": 120},
            "text": [{"text": "{{club.name}}", "marks": {"bold": True, "size": 34}}],
            "styleRef": "H1",
            "padding": 10,
            "bg": "rgba(0,0,0,0)",
        }

    def caption():
        return {
            "id": uuid.uuid4().hex,
            "type": "TextFrame",
            "rect": {"x": 42, "y": A4_H - 140, "w": A4_W - 84, "h": 90},
            "text": [{"text": "Edita este pie de foto. Puedes mezclar estilos (PRO).", "marks": {}}],
            "styleRef": "Caption",
            "padding": 10,
            "bg": "rgba(0,0,0,0)",
        }

    pages: List[Dict[str, Any]] = []
    for idx, aid in enumerate(bg_asset_ids):
        items = [bg_item(aid)]
        # Make the first page more editable (cover): title/subtitle
        if idx == 0:
            items.append(headline())
            items.append({
                "id": uuid.uuid4().hex,
                "type": "TextFrame",
                "rect": {"x": 42, "y": 168, "w": A4_W - 84, "h": 90},
                "text": [{"text": "Titular principal · Cambia texto, color, tamaño y estilos", "marks": {"bold": True, "size": 18}}],
                "styleRef": "Deck",
                "padding": 10,
                "bg": "rgba(0,0,0,0)",
            })
        elif idx % 5 == 0:
            # Every 5 pages, add a section header
            items.append({
                "id": uuid.uuid4().hex,
                "type": "TextFrame",
                "rect": {"x": 42, "y": 40, "w": A4_W - 84, "h": 70},
                "text": [{"text": "Sección · Reportaje / Entrevista / Estadísticas", "marks": {"bold": True, "size": 20}}],
                "styleRef": "H2",
                "padding": 10,
                "bg": "rgba(255,255,255,0)",
            })
        else:
            items.append(caption())

        pages.append({
            "id": uuid.uuid4().hex,
            "size": {"w": A4_W, "h": A4_H},
            "layers": [
                {"id": uuid.uuid4().hex, "name": "Fondo", "visible": True, "locked": True, "items": [bg_item(aid)]},
                {"id": uuid.uuid4().hex, "name": "Contenido", "visible": True, "locked": False, "items": [it for it in items if it["type"] != "ImageFrame" or it.get("role") != "page_background"]},
            ],
        })

    styles = {
        "textStyles": {
            "H1": {"fontFamily": "Inter", "fontSize": 34, "fontWeight": 900, "color": "#ffffff"},
            "H2": {"fontFamily": "Inter", "fontSize": 20, "fontWeight": 800, "color": "#ffffff"},
            "Deck": {"fontFamily": "Inter", "fontSize": 18, "fontWeight": 700, "color": "#ffffff"},
            "Body": {"fontFamily": "Inter", "fontSize": 13, "fontWeight": 400, "color": "#111827"},
            "Caption": {"fontFamily": "Inter", "fontSize": 12, "fontWeight": 500, "color": "#ffffff"},
        }
    }

    return {
        "name": name,
        "pages": pages,
        "styles": styles,
        "meta": {"source": "sample_pdfs", "sport": sport},
    }


def ensure_sample_magazines_seeded(db: Session):
    """Seed 6 realistic templates from bundled PDFs (once)."""
    existing = db.query(Template).filter(Template.origin == "sample_pdf_catalog").count()
    if existing >= 6:
        return

    # Remove any older sample catalog to avoid duplicates.
    old = db.query(Template).filter(Template.origin == "sample_pdf_catalog").all()
    for t in old:
        db.delete(t)
    db.commit()

    bdir = _bundled_dir()
    os.makedirs(bdir, exist_ok=True)

    seeded = 0
    for i, s in enumerate(SAMPLES):
        path = os.path.join(bdir, s.filename)
        if not os.path.exists(path):
            continue
        prefix = f"{i+1:02d}"
        bg_assets = _render_pdf_pages_to_assets(db, path, prefix=prefix, max_pages=40, zoom=1.4)
        if not bg_assets:
            continue
        doc = _build_template_document(name=s.name, bg_asset_ids=bg_assets)
        t = Template(
            id=str(uuid.uuid4()),
            name=f"{s.name} (real)",
            origin="sample_pdf_catalog",
            sport="football",
            pages=len(doc.get("pages") or []),
            document_json=json.dumps(doc, ensure_ascii=False),
        )
        db.add(t)
        seeded += 1
    db.commit()

    # If we seeded fewer than 6 (missing PDFs), do nothing else.
    return

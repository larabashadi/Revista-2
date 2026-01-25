from __future__ import annotations
from typing import Dict, Any, List, Tuple
import fitz
from sqlalchemy.orm import Session

from app.services.storage import save_local_file
from app.models.models import Asset

A4_W, A4_H = 595.2756, 841.8898


def _render_page_image(doc: fitz.Document, page_index: int, scale: float = 1.5) -> bytes:
    page = doc.load_page(page_index)
    mat = fitz.Matrix(scale, scale)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    return pix.tobytes("png")


def _mk_asset(db: Session, club_id: str, content: bytes, filename: str, mime: str = "image/png") -> str:
    asset_id, _path = save_local_file(content, f"{filename}.png")
    asset = Asset(
        id=asset_id,
        club_id=club_id,
        filename=f"{filename}.png",
        mime=mime,
        storage_path=asset_id,
    )
    db.add(asset)
    db.commit()
    return asset_id


def import_pdf_to_document(
    db: Session,
    club_id: str,
    pdf_bytes: bytes,
    mode: str = "safe",
    preset: str = "smart",
) -> Tuple[Dict[str, Any], List[str]]:
    """
    Modos:
      - preset=background  -> SOLO fondos (rápido, no se cuelga en Render)
      - preset=smart/text/pro -> puede extraer más (pero es pesado)
    """

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages: List[Dict[str, Any]] = []
    created_asset_ids: List[str] = []

    background_only = preset in ("background", "bg", "bg_only", "raster")

    # Escala más baja para evitar timeouts/oom en Render
    if background_only:
        scale = 1.25 if doc.page_count > 24 else 1.5
    else:
        scale = 2.0

    for i in range(doc.page_count):
        # 1) Fondo raster (siempre)
        bg_png = _render_page_image(doc, i, scale=scale)
        bg_asset_id = _mk_asset(db, club_id, bg_png, f"import_bg_p{i+1}")
        created_asset_ids.append(bg_asset_id)

        bg_item = {
            "id": f"bg-{i}",
            "type": "ImageFrame",
            "rect": {"x": 0, "y": 0, "w": A4_W, "h": A4_H},
            "assetRef": bg_asset_id,
            "fitMode": "cover",
            "crop": {"x": 0, "y": 0, "w": 1, "h": 1},
            "locked": True,
            "role": "pdf_background",
        }

        # 2) Si es background-only, NO hacemos extracción pesada
        if background_only:
            layers = [
                {"id": "bg", "name": "PDF Fondo", "visible": True, "locked": True, "items": [bg_item]},
                {"id": "overlay", "name": "Detectado", "visible": False, "locked": False, "items": []},
            ]
            pages.append({"id": f"p-{i}", "sectionType": "Imported", "layers": layers})
            continue

        # (Opcional) aquí iría extracción de texto/imágenes.
        # Para Render, si quieres estabilidad, mantenlo en background-only.

        layers = [
            {"id": "bg", "name": "PDF Fondo", "visible": True, "locked": True, "items": [bg_item]},
            {"id": "overlay", "name": "Detectado", "visible": False, "locked": False, "items": []},
        ]
        pages.append({"id": f"p-{i}", "sectionType": "Imported", "layers": layers})

    document: Dict[str, Any] = {
        "schema": "magazine-doc@1",
        "meta": {"import_preset": preset, "import_mode": mode},
        "pages": pages,
        "pageSize": {"w": A4_W, "h": A4_H},
    }
    return document, created_asset_ids

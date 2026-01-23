from __future__ import annotations

import json
import uuid
from sqlalchemy.orm import Session

from app.models.models import Template
from app.services.catalog_assets import ensure_catalog_assets
from app.services.template_generator import generate_catalog_template_v2

# 6 templates base (multi-deporte) con 40 páginas cada una.
# Son diseños generados desde cero (JSON) con placeholders (offline-safe), NO PDFs importados.
CATALOG: list[tuple[str, str, str]] = [
    ("Portada Fotográfica · Multi", "photographic", "football"),
    ("Magazine Bold · Multi", "bold_mag", "basket"),
    ("Diario Editorial · Multi", "newspaper_editorial", "football"),
    ("Tech & Datos · Multi", "tech_data", "basket"),
    ("Sponsors Pro · Multi", "sponsors_first", "football"),
    ("Academia / Cantera · Multi", "academy_youth", "basket"),
]

def ensure_catalog_seeded(db: Session):
    # If already has any gen-v2 catalog templates, skip
    existing = db.query(Template).filter(Template.origin == "catalog_v2").count()
    if existing >= len(CATALOG):
        return

    # Remove old catalog templates to avoid duplicates
    old = db.query(Template).filter(Template.origin.in_(["catalog", "generated"])).all()
    for t in old:
        db.delete(t)
    db.commit()

    pools = ensure_catalog_assets(db)

    for i, (name, style, sport) in enumerate(CATALOG):
        template_id = str(uuid.uuid4())
        doc = generate_catalog_template_v2(style=style, sport=sport, seed=10000+i, asset_pools=pools)
        t = Template(
            id=template_id,
            name=name,
            origin="catalog_v2",
            sport=sport,
            pages=len(doc.get("pages") or []),
            document_json=json.dumps(doc),
        )
        db.add(t)

    db.commit()

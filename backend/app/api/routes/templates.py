from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.security import get_current_user
from app.models.models import Template, Club
from app.schemas.schemas import TemplateOut
from app.services.catalog_seed import ensure_catalog_seeded

router = APIRouter(prefix="/api/templates", tags=["templates"])

@router.get("", response_model=list[TemplateOut])
def list_templates(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    # 1) si no hay plantillas, seed en caliente (evita quedarte con [] para siempre)
    if db.query(Template).count() == 0:
        ensure_catalog_seeded(db)

    templates_q = db.query(Template).order_by(Template.created_at.desc())

    # 2) regla de bloqueo por club: si está bloqueado y chosen_template_id existe pero NO está en DB,
    #    no devolvemos [] (eso te “rompe” el dashboard). Desbloqueamos o devolvemos todas.
    club = (
        db.query(Club)
        .filter(Club.owner_user_id == user.id)
        .order_by(Club.created_at.desc())
        .first()
    )
    if club and club.templates_locked and club.chosen_template_id:
        chosen = (
            db.query(Template)
            .filter(Template.id == club.chosen_template_id)
            .first()
        )
        if chosen:
            return [chosen]
        # fallback: desbloquea porque el chosen ya no existe
        club.templates_locked = False
        club.chosen_template_id = None
        db.commit()

    return templates_q.all()

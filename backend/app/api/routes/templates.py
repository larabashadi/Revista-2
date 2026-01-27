from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user  # ✅ aquí, no desde core.security
from app.core.db import get_db
from app.models.models import Template
from app.schemas.schemas import TemplateOut

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("", response_model=list[TemplateOut])
def list_templates(
    q: str | None = Query(default=None),
    origin: str | None = Query(default=None),
    sport: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    qs = db.query(Template)

    if origin:
        qs = qs.filter(Template.origin == origin)
    if sport:
        qs = qs.filter(Template.sport == sport)
    if q:
        like = f"%{q}%"
        qs = qs.filter(Template.name.ilike(like))

    return qs.order_by(Template.created_at.desc()).all()


@router.get("/{template_id}", response_model=TemplateOut)
def get_template(
    template_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    t = db.get(Template, template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return t


@router.get("/{template_id}/thumbnail")
def get_thumbnail(
    template_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    t = db.get(Template, template_id)
    if not t or not t.thumbnail_png:
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    return Response(content=t.thumbnail_png, media_type="image/png")


@router.get("/{template_id}/preview")
def get_preview_pdf(
    template_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    t = db.get(Template, template_id)
    if not t or not t.preview_pdf:
        raise HTTPException(status_code=404, detail="Preview not found")
    return Response(content=t.preview_pdf, media_type="application/pdf")

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.services.templates_service import list_templates, get_template_thumbnail, get_template_preview_pdf

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("")
def templates(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # list_templates ya mezcla catálogo + generadas del user (según tu servicio)
    return list_templates(db=db, user=user)


@router.get("/{template_id}/thumbnail")
def template_thumbnail(template_id: str, page: int = 0, size: int = 480,
                      db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    data, media_type = get_template_thumbnail(db=db, user=user, template_id=template_id, page=page, size=size)
    return data


@router.get("/{template_id}/preview.pdf")
def template_preview(template_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return get_template_preview_pdf(db=db, user=user, template_id=template_id)

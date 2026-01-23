from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.api.deps import require_super_admin
from app.core.settings import settings
from app.models.models import User, Club

router = APIRouter(prefix="/api/admin", tags=["admin"])


class AllowedTemplatesPayload(BaseModel):
    """Payload used to patch the list of allowed template IDs for a club."""

    # If empty/None -> allow all templates.
    allowed_template_ids: Optional[List[str]] = None

def _ip_allowed(req: Request) -> bool:
    allowed = (getattr(settings, "ADMIN_ALLOWED_IPS", "") or "").strip()
    if not allowed:
        return True
    allow = {x.strip() for x in allowed.split(",") if x.strip()}
    client_ip = (req.client.host if req.client else "") or ""
    return client_ip in allow

@router.get("/users")
def list_users(req: Request, db: Session = Depends(get_db), _=Depends(require_super_admin)):
    if not _ip_allowed(req):
        raise HTTPException(status_code=403, detail="IP not allowed")
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {"id": u.id, "email": u.email, "role": getattr(u, "role", "user"), "created_at": u.created_at.isoformat()}
        for u in users
    ]

@router.patch("/users/{user_id}/role")
def set_user_role(user_id: str, payload: dict, req: Request, db: Session = Depends(get_db), _=Depends(require_super_admin)):
    if not _ip_allowed(req):
        raise HTTPException(status_code=403, detail="IP not allowed")
    role = (payload.get("role") or "").strip()
    if role not in {"user", "super_admin", "disabled"}:
        raise HTTPException(status_code=400, detail="Invalid role")
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u.role = role
    db.add(u); db.commit()
    return {"ok": True}


@router.get("/clubs", dependencies=[Depends(require_super_admin)])
def list_clubs(db: Session = Depends(get_db)):
    clubs = db.query(Club).order_by(Club.created_at.desc()).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "owner_id": c.owner_id,
            "plan": c.plan,
            "templates_locked": getattr(c, "templates_locked", False),
            "chosen_template_id": getattr(c, "chosen_template_id", None),
            "allowed_template_ids": getattr(c, "allowed_template_ids", None),
        }
        for c in clubs
    ]


@router.patch("/clubs/{club_id}/allowed-templates", dependencies=[Depends(require_super_admin)])
def set_allowed_templates(club_id: str, payload: AllowedTemplatesPayload, db: Session = Depends(get_db)):
    club = db.query(Club).filter(Club.id == club_id).first()
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")
    if payload.allowed_template_ids:
        import json as _json
        club.allowed_template_ids = _json.dumps(payload.allowed_template_ids)
    else:
        club.allowed_template_ids = None
    db.add(club)
    db.commit()
    db.refresh(club)
    return {"ok": True, "allowed_template_ids": club.allowed_template_ids}

from __future__ import annotations
import json
import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.api.deps import get_current_user, get_club_or_404
from app.models.models import Project, Template
from app.schemas.schemas import ProjectCreate, ProjectOut, ProjectUpdate
from app.services.pdf_importer import detect_pdf_page_overlays
from app.services.storage import get_path_for_asset

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.post("/item/{project_id}/detect/{page_index}")
def detect_page(
    project_id: str,
    page_index: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """On-demand detection: returns (and persists) detected text/image boxes for a single page."""
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    club = get_club_or_404(db, proj.club_id)
    if club.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    doc = json.loads(proj.document_json or "{}")
    pages = doc.get("pages") or []
    if page_index < 0 or page_index >= len(pages):
        raise HTTPException(status_code=400, detail="Invalid page_index")

    source_pdf_asset_id = (doc.get("meta") or {}).get("source_pdf_asset_id")
    if not source_pdf_asset_id:
        raise HTTPException(status_code=400, detail="No source PDF stored for this project")
    pdf_path = get_path_for_asset(source_pdf_asset_id)
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=400, detail="Source PDF file not found on server")

    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    detected = detect_pdf_page_overlays(pdf_bytes=pdf_bytes, page_index=page_index)
    # Persist detected overlays into the project document
    page = pages[page_index]
    page.setdefault("detected", {})
    page["detected"]["text"] = detected.get("text", [])
    page["detected"]["images"] = detected.get("images", [])
    doc["pages"] = pages
    proj.document_json = json.dumps(doc, ensure_ascii=False)
    proj.updated_at = datetime.utcnow()
    db.add(proj)
    db.commit()
    return {"detected": page["detected"]}

@router.get("/{club_id}")
def list_projects(club_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    club = get_club_or_404(db, club_id)
    if club.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    items = db.query(Project).filter(Project.club_id==club_id).order_by(Project.updated_at.desc()).all()
    return {"projects":[{"id":p.id,"name":p.name,"template_id":p.template_id,"updated_at":p.updated_at.isoformat()+"Z"} for p in items]}

@router.post("/{club_id}", response_model=ProjectOut)
def create_project(club_id: str, payload: ProjectCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    club = get_club_or_404(db, club_id)
    if club.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    t = db.get(Template, payload.template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    doc = json.loads(t.document_json)
    proj = Project(club_id=club_id, name=payload.name, template_id=t.id, document_json=json.dumps(doc, ensure_ascii=False))
    db.add(proj); db.commit(); db.refresh(proj)
    return ProjectOut(id=proj.id, club_id=proj.club_id, name=proj.name, template_id=proj.template_id, document=doc)

@router.get("/item/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    club = get_club_or_404(db, proj.club_id)
    if club.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return ProjectOut(id=proj.id, club_id=proj.club_id, name=proj.name, template_id=proj.template_id, document=json.loads(proj.document_json))

@router.put("/item/{project_id}", response_model=ProjectOut)
def update_project(project_id: str, payload: ProjectUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    club = get_club_or_404(db, proj.club_id)
    if club.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if payload.name is not None:
        proj.name = payload.name
    proj.document_json = json.dumps(payload.document, ensure_ascii=False)
    proj.updated_at = datetime.utcnow()
    db.commit(); db.refresh(proj)
    return ProjectOut(id=proj.id, club_id=proj.club_id, name=proj.name, template_id=proj.template_id, document=json.loads(proj.document_json))


@router.put("/item/{project_id}/page/{page_index}")
def update_project_page(project_id: str, page_index: int, payload: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Update a single page of a project document.

    This keeps saves lightweight (page-by-page) while keeping the full document JSON
    as the source of truth.
    Expected payload: {"page": <page_object>}
    """
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    club = get_club_or_404(db, proj.club_id)
    if club.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    doc = json.loads(proj.document_json)
    pages = doc.get("pages") or []
    if page_index < 0 or page_index >= len(pages):
        raise HTTPException(status_code=400, detail="Invalid page_index")
    page = payload.get("page")
    if not isinstance(page, dict):
        raise HTTPException(status_code=400, detail="Missing page")

    pages[page_index] = page
    doc["pages"] = pages
    proj.document_json = json.dumps(doc, ensure_ascii=False)
    proj.updated_at = datetime.utcnow()
    db.commit(); db.refresh(proj)
    return {"ok": True}

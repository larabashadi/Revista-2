from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session
from rq import Queue
import redis

from app.core.db import get_db
from app.core.settings import settings
from app.api.deps import get_current_user, get_club_plan, get_club_or_404
from app.models.models import Project, Club
from app.schemas.schemas import ExportRequest
from app.jobs import export_project_job
from app.services.storage import get_local_path
from app.services.pdf_exporter import export_document_to_pdf
import json

router = APIRouter(prefix="/api/export", tags=["export"])
redis_conn = redis.from_url(settings.REDIS_URL)
q = Queue("default", connection=redis_conn)


def _safe_filename(name: str) -> str:
    """Create a safe filename fragment from an arbitrary string."""
    name = (name or "").strip()
    if not name:
        return "Club"
    # Keep letters, numbers, dash, underscore and space. Convert others to underscore.
    out = []
    for ch in name:
        if ch.isalnum() or ch in "-_ ":
            out.append(ch)
        else:
            out.append("_")
    s = "".join(out).strip().replace(" ", "_")
    # Avoid empty / pathological names
    return s[:80] or "Club"

@router.post("/{project_id}")
def export_project(project_id: str, payload: ExportRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    club = get_club_or_404(db, proj.club_id)
    if club.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    plan = get_club_plan(db, club.id)
    watermark = True if plan != "pro" else False
    # allow demo export with watermark for free (conversion-friendly)
    body = payload.model_dump()
    body["watermark"] = watermark
    job = q.enqueue(export_project_job, proj.id, club.id, body, settings.DATABASE_URL, job_timeout=300)
    return {"job_id": job.get_id(), "watermark": watermark, "plan": plan}


# Fallback: synchronous export (no worker/queue). Useful if the RQ worker is not running.
@router.post("/sync/{project_id}")
def export_project_sync(project_id: str, payload: ExportRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    club = get_club_or_404(db, proj.club_id)
    if club.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    plan = get_club_plan(db, club.id)
    watermark = True if plan != "pro" else False

    doc = json.loads(proj.document_json)
    # The exporter is DB-aware (it resolves Asset ids to local paths).
    # Older iterations passed a resolver callback + print options (bleed/crop).
    # In this codebase we keep the signature minimal and ignore bleed/crop for now.
    pdf_bytes = export_document_to_pdf(
        db,
        doc,
        quality=payload.quality,
        watermark=watermark,
    )
    # Lock templates on first export (per club)
    club = db.get(Club, project.club_id)
    if club and not getattr(club, "templates_locked", False):
        club.templates_locked = True
        club.chosen_template_id = project.template_id
        db.add(club)
        db.commit()


    filename = f"Revista_{_safe_filename(club.name)}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@router.get("/job/{job_id}")
def export_status(job_id: str):
    job = q.fetch_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.is_failed:
        return {"status":"failed", "error": str(job.exc_info)}
    if job.is_finished:
        return {"status":"finished", **(job.result or {})}
    return {"status":"queued"}


# Backwards-compatible alias (older frontend builds polled /status/{job_id})
@router.get("/status/{job_id}")
def export_status_alias(job_id: str):
    return export_status(job_id)

@router.get("/download/{asset_id}")
def download_export(asset_id: str, filename: str | None = Query(default=None)):
    try:
        path = get_local_path(asset_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    dl = filename or "Revista.pdf"
    return FileResponse(path, media_type="application/pdf", filename=dl)

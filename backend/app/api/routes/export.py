from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.settings import settings
from app.api.deps import get_current_user, get_club_plan, get_club_or_404
from app.models.models import Project, Club
from app.services.pdf_exporter import export_document_to_pdf
from app.services.storage import get_local_path

# Optional queue support (RQ/Redis). If REDIS_URL isn't configured (or fails),
# we fall back to synchronous export.
_q = None
try:
    if getattr(settings, "REDIS_URL", None):
        import redis
        from rq import Queue

        redis_conn = redis.from_url(settings.REDIS_URL)
        _q = Queue("default", connection=redis_conn)
except Exception:
    _q = None

router = APIRouter(prefix="/api/export", tags=["export"])


def _safe_filename(name: str) -> str:
    s = (name or "").strip().replace("/", "_").replace("\\", "_")
    s = "".join(ch if ch.isalnum() or ch in ("-", "_", " ") else "_" for ch in s)
    s = s.replace(" ", "_")
    return (s[:80] or "Club")


@router.post("/{project_id}")
def export_project(project_id: str, payload: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Export project.

    - If Redis/RQ is configured, enqueue a job (requires a worker).
    - Otherwise, export synchronously and return the PDF bytes directly.
    """
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    club = get_club_or_404(db, proj.club_id)
    if club.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    quality = (payload or {}).get("quality") or "web"
    plan = get_club_plan(db, club.id)
    watermark = True if plan != "pro" else False

    # No queue -> sync export
    if _q is None:
        pdf_bytes = export_document_to_pdf(db, json.loads(proj.document_json), quality=quality, watermark=watermark)
        filename = f"Revista_{_safe_filename(club.name)}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    # Queue export (requires worker)
    from app.jobs import export_project_job  # lazy import (keeps startup robust)

    body = {"quality": quality, "watermark": watermark}
    job = _q.enqueue(export_project_job, proj.id, club.id, body, settings.DATABASE_URL, job_timeout=300)
    return {"job_id": job.get_id(), "watermark": watermark, "plan": plan}


@router.post("/sync/{project_id}")
def export_project_sync(project_id: str, payload: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    club = get_club_or_404(db, proj.club_id)
    if club.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    quality = (payload or {}).get("quality") or "web"
    plan = get_club_plan(db, club.id)
    watermark = True if plan != "pro" else False

    pdf_bytes = export_document_to_pdf(db, json.loads(proj.document_json), quality=quality, watermark=watermark)

    # Lock templates on first export (business rule)
    if club and not getattr(club, "templates_locked", False):
        club.templates_locked = True
        club.chosen_template_id = getattr(proj, "template_id", None)
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
    if _q is None:
        raise HTTPException(status_code=400, detail="Queue not configured")
    job = _q.fetch_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.is_failed:
        return {"status": "failed", "error": str(job.exc_info)}
    if job.is_finished:
        return {"status": "finished", **(job.result or {})}
    return {"status": "queued"}


@router.get("/status/{job_id}")
def export_status_alias(job_id: str):
    return export_status(job_id)


@router.get("/download/{asset_id}")
def download_export(asset_id: str, filename: Optional[str] = Query(default=None)):
    try:
        path = get_local_path(asset_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    dl = filename or "Revista.pdf"
    return FileResponse(path, media_type="application/pdf", filename=dl)

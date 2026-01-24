from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.api.deps import get_current_user, get_club_plan, get_club_or_404
from app.models.models import Project, Club
from app.schemas.schemas import ExportRequest
from app.services.storage import get_local_path
from app.services.pdf_exporter import export_document_to_pdf

# Optional queue (RQ/Redis). In many free hosting setups (Render free), you won't
# run a Redis instance or a worker, so we keep export working via /sync.
try:
    from rq import Queue  # type: ignore
    import redis  # type: ignore
    from app.core.settings import settings

    _redis_conn = None
    _q = None
    if getattr(settings, "REDIS_URL", None):
        try:
            _redis_conn = redis.from_url(settings.REDIS_URL)
            _q = Queue("default", connection=_redis_conn)
        except Exception:
            _q = None
except Exception:
    _q = None

# If queue exists, we can enqueue background jobs
if _q is not None:
    from app.jobs import export_project_job  # imported only when queue is usable

router = APIRouter(prefix="/api/export", tags=["export"])


def _safe_filename(name: str) -> str:
    """Create a safe filename fragment from an arbitrary string."""
    name = (name or "").strip()
    if not name:
        return "Club"
    out = []
    for ch in name:
        if ch.isalnum() or ch in "-_ ":
            out.append(ch)
        else:
            out.append("_")
    s = "".join(out).strip().replace(" ", "_")
    return s[:80] or "Club"


@router.post("/{project_id}")
def export_project(
    project_id: str,
    payload: ExportRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Queue export if Redis/RQ is available. Otherwise instruct to use /sync."""
    if _q is None:
        raise HTTPException(
            status_code=503,
            detail="Export queue not available. Use POST /api/export/sync/{project_id}.",
        )

    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    club = get_club_or_404(db, proj.club_id)
    if club.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    plan = get_club_plan(db, club.id)
    watermark = True if plan != "pro" else False

    body = payload.model_dump()
    body["watermark"] = watermark

    # job_timeout in seconds
    job = _q.enqueue(export_project_job, proj.id, club.id, body, job_timeout=300)
    return {"job_id": job.get_id(), "watermark": watermark, "plan": plan}


@router.post("/sync/{project_id}")
def export_project_sync(
    project_id: str,
    payload: ExportRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Synchronous export (no worker/queue)."""
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    club = get_club_or_404(db, proj.club_id)
    if club.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    plan = get_club_plan(db, club.id)
    watermark = True if plan != "pro" else False

    doc = json.loads(proj.document_json)

    pdf_bytes = export_document_to_pdf(
        db,
        doc,
        quality=payload.quality,
        watermark=watermark,
    )

    # Lock templates on first export (per club)
    club_obj = db.get(Club, proj.club_id)
    if club_obj and not getattr(club_obj, "templates_locked", False):
        club_obj.templates_locked = True
        club_obj.chosen_template_id = proj.template_id
        db.add(club_obj)
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
        raise HTTPException(status_code=503, detail="Export queue not available")
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
def download_export(asset_id: str, filename: str | None = Query(default=None)):
    try:
        path = get_local_path(asset_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    dl = filename or "Revista.pdf"
    return FileResponse(path, media_type="application/pdf", filename=dl)

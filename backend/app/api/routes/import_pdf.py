from __future__ import annotations
import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.api.deps import get_current_user, get_club_or_404
from app.models.models import Project
from app.services.pdf_importer import import_pdf_to_document
from app.services.storage import save_local_file

router = APIRouter(prefix="/api/import", tags=["import"])

@router.post("/{club_id}")
async def import_pdf(club_id: str, mode: str="safe", preset: str="smart", file: UploadFile = File(...), db: Session = Depends(get_db), user=Depends(get_current_user)):
    club = get_club_or_404(db, club_id)
    if club.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF supported")
    pdf_bytes = await file.read()
    if not pdf_bytes or len(pdf_bytes) < 500:
        raise HTTPException(status_code=400, detail="Invalid PDF")

    # Persist original PDF so we can run on-demand page detection later (text/images)
    source_pdf_asset_id, _src_path = save_local_file(pdf_bytes, filename=f"source_{club_id}.pdf")

    # IMPORTANT: importer needs DB session to create assets for background + extracted images.
    document, _assets = import_pdf_to_document(db, club_id, pdf_bytes, mode=mode, preset=preset)
    document.setdefault("meta", {})["source_pdf_asset_id"] = source_pdf_asset_id
    proj = Project(club_id=club_id, name=f"Importado - {file.filename}", template_id="import_pdf", document_json=json.dumps(document, ensure_ascii=False))
    db.add(proj); db.commit(); db.refresh(proj)
    return {"project_id": proj.id, "pages": len(document.get("pages", [])), "mode": mode, "preset": preset}

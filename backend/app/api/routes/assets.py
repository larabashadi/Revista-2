from __future__ import annotations

import mimetypes
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.api.deps import get_current_user
from app.models.models import Club, Asset
from app.services.storage import save_local_file, get_local_path

router = APIRouter(prefix="/api/assets", tags=["assets"])


@router.post("/{club_id}")
async def upload_asset(
    club_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    club = db.get(Club, club_id)
    if not club or club.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Club not found")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty upload")

    filename = file.filename or "asset.bin"
    mime = file.content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"

    asset_id, _path = save_local_file(content, filename)

    asset = Asset(
        id=asset_id,
        club_id=club.id,
        filename=filename,
        mime=mime,
        storage_path=asset_id,
    )
    db.add(asset)
    db.commit()

    return {"id": asset_id, "url": f"/api/assets/file/{asset_id}", "filename": filename, "mime": mime}


@router.get("/file/{asset_id}")
def get_asset_file(asset_id: str, db: Session = Depends(get_db)):
    asset = db.get(Asset, asset_id)
    try:
        path = get_local_path(asset_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Asset not found")

    media_type = (asset.mime if asset else None) or mimetypes.guess_type(path)[0] or "application/octet-stream"

    # Cache assets aggressively (they are content-addressed by id)
    return FileResponse(
        path,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )

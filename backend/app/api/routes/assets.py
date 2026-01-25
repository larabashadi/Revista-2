from __future__ import annotations
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

    asset_id, _path = save_local_file(content, file.filename or "asset.bin")

    asset = Asset(
        id=asset_id,
        club_id=club.id,
        filename=file.filename or "asset.bin",
        mime=file.content_type or "application/octet-stream",
        storage_path=asset_id,
    )
    db.add(asset)
    db.commit()

    return {"id": asset_id, "url": f"/api/assets/file/{asset_id}", "filename": asset.filename, "mime": asset.mime}


@router.put("/{asset_id}")
async def replace_asset(
    asset_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    asset = db.get(Asset, asset_id)
    if not asset or not asset.club_id:
        raise HTTPException(status_code=404, detail="Asset not found")

    club = db.get(Club, asset.club_id)
    if not club or club.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty upload")

    # Guardamos como nuevo fichero, pero mantenemos el mismo asset_id (para "reemplazar")
    new_id, _path = save_local_file(content, file.filename or asset.filename)

    asset.filename = file.filename or asset.filename
    asset.mime = file.content_type or asset.mime
    asset.storage_path = new_id
    db.add(asset)
    db.commit()

    return {"id": asset.id, "url": f"/api/assets/file/{asset.id}", "filename": asset.filename, "mime": asset.mime}


@router.get("/file/{asset_id}")
def get_asset_file(asset_id: str, db: Session = Depends(get_db)):
    asset = db.get(Asset, asset_id)
    # Si no está en DB, igualmente intentamos resolverlo por storage (compat)
    try:
        storage_key = asset.storage_path if asset else asset_id
        path = get_local_path(storage_key)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Asset not found")

    media = asset.mime if asset else None
    headers = {"Cache-Control": "public, max-age=31536000, immutable"}
    return FileResponse(path, media_type=media, headers=headers)

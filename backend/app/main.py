from __future__ import annotations

import logging
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.db import engine, Base, SessionLocal
from app.api.routes.auth import router as auth_router
from app.api.routes.clubs import router as clubs_router
from app.api.routes.assets import router as assets_router
from app.api.routes.templates import router as templates_router
from app.api.routes.projects import router as projects_router
from app.api.routes.export import router as export_router
from app.api.routes.import_pdf import router as import_router
from app.api.routes.admin import router as admin_router
from app.core.migrations import ensure_schema
from app.services.superadmin import ensure_super_admin
from app.services.catalog_seed import ensure_catalog_seeded
# IMPORTANT:
# We deliberately do NOT seed templates from bundled "sample PDFs".
# That approach made the catalog look like it was reusing PDFs and didn't provide
# editable, reusable layouts. The catalog must be generated from our own JSON
# templates (with placeholders) so users can customize everything.

logger = logging.getLogger("magazine")

def create_app() -> FastAPI:
    app = FastAPI(title="Sports Magazine SaaS", version="10.4.12")
        app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
    )


    @app.on_event("startup")
    def _startup() -> None:
        # Wait for DB (docker-compose depends_on doesn't guarantee readiness)
        last_err: Exception | None = None
        for _ in range(30):
            try:
                Base.metadata.create_all(bind=engine)
                ensure_schema(engine)
                last_err = None
                break
            except Exception as e:
                last_err = e
                time.sleep(1)

        if last_err is not None:
            # If DB never became ready, crash clearly.
            raise last_err

        # Best-effort seed (never crash the API if seeding fails)
        db = SessionLocal()
        try:
            ensure_catalog_seeded(db)
            ensure_super_admin(db)
        except Exception:
            logger.exception("Catalog seeding failed (continuing without auto-catalog).")
        finally:
            db.close()

    app.include_router(auth_router)
    app.include_router(clubs_router)
    app.include_router(assets_router)
    app.include_router(templates_router)
    app.include_router(projects_router)
    app.include_router(export_router)
    app.include_router(import_router)
    app.include_router(admin_router)

    @app.get("/api/health")
    def health():
        return {"ok": True, "ts": int(time.time())}

    @app.get("/api/version")
    def version():
        # Small endpoint used by the frontend to verify API reachability.
        return {"ok": True, "version": app.version, "ts": int(time.time())}

    return app

app = create_app()

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Engine

def _has_column(engine: Engine, table: str, column: str) -> bool:
    q = text("""
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = :table
          AND column_name = :col
        LIMIT 1
    """)
    with engine.connect() as conn:
        row = conn.execute(q, {"table": table, "col": column}).first()
        return row is not None

def ensure_schema(engine: Engine) -> None:
    # Lightweight, idempotent schema patching (no Alembic).
    if not _has_column(engine, "users", "role"):
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'user'"))

    # Club template locking fields
    if not _has_column(engine, "clubs", "chosen_template_id"):
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE clubs ADD COLUMN chosen_template_id VARCHAR(36)"))
    if not _has_column(engine, "clubs", "templates_locked"):
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE clubs ADD COLUMN templates_locked BOOLEAN NOT NULL DEFAULT FALSE"))

    if not _has_column(engine, "clubs", "allowed_template_ids"):
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE clubs ADD COLUMN allowed_template_ids TEXT"))

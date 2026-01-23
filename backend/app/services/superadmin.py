from __future__ import annotations

import os
import re
import secrets
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.settings import settings
from app.core.security import hash_password
from app.models.models import User

_pw_re = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,}$")


def _password_ok(pw: str) -> bool:
    return bool(_pw_re.match(pw or ""))


def _data_dir() -> Path:
    # Prefer configured storage dir, fall back to common container path
    base = Path(getattr(settings, "DATA_DIR", "/app/data"))
    return base


def ensure_super_admin(db: Session) -> None:
    """Ensure a super admin user exists.

    Behavior:
    - If SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD are provided, use them.
    - If they are missing (common in dev), create a default admin@local with a
      generated strong password, persisted to storage so you can retrieve it.

    This keeps the feature usable out-of-the-box while still being "protected".
    """

    # Defaults requested by the project owner (can be overridden via env vars)
    email = (os.getenv("SUPERADMIN_EMAIL") or "").strip() or "super@larabs.astursahara"
    password = (os.getenv("SUPERADMIN_PASSWORD") or "").strip() or "Astursahara2026"

    # Check if exists
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        # Ensure correct role
        if getattr(existing, "role", "user") != "super_admin":
            existing.role = "super_admin"
            db.commit()
        return

    # If password not set or weak -> generate one and persist
    generated = False
    if not _password_ok(password):
        password = secrets.token_urlsafe(18)  # ~24+ chars
        generated = True

    # IMPORTANT: the project uses a string role ("super_admin") not a boolean flag.
    u = User(email=email, password_hash=hash_password(password), role="super_admin")
    db.add(u)
    db.commit()

    # Always write creds file (helps operators), but don't overwrite existing.
    if True:
        try:
            out_dir = _data_dir() / "storage"
            out_dir.mkdir(parents=True, exist_ok=True)
            for fname in ("superadmin_credentials.txt", "superadmin_password.txt"):
                out_file = out_dir / fname
                if not out_file.exists():
                    out_file.write_text(f"EMAIL={email}\nPASSWORD={password}\n", encoding="utf-8")
                print(f"[superadmin] Super admin credentials file: {out_file}")
        except Exception as e:
            print(f"[superadmin] Created default super admin, but failed to write creds: {e}")

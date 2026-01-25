from __future__ import annotations
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    APP_ENV: str = "dev"
    APP_SECRET_KEY: str = "change_me"
    APP_JWT_EXPIRE_MIN: int = 60 * 24 * 7
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@db:5432/magazine"
    REDIS_URL: str = "redis://redis:6379/0"
    STORAGE_MODE: str = "local"
    # Render (and many PaaS) run your code from a read-only source directory.
    # Use /tmp by default, you can override with STORAGE_LOCAL_DIR.
    STORAGE_LOCAL_DIR: str = "/tmp/revista_storage"

    SUPERADMIN_EMAIL: str = ""
    SUPERADMIN_PASSWORD: str = ""
    ADMIN_ALLOWED_IPS: str = ""  # comma-separated, optional

settings = Settings()

import os
import tempfile
from pydantic import BaseSettings

class Settings(BaseSettings):
    # IMPORTANT:
    # Render (y algunos hosts) pueden tener el directorio del proyecto como solo-lectura.
    # Guardamos assets/PDFs en /tmp por defecto (escribible).
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./data/app.db")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev_secret_change_me")
    STORAGE_LOCAL_DIR: str = os.getenv("STORAGE_LOCAL_DIR", os.path.join(tempfile.gettempdir(), "revista_storage"))
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@example.com")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin123")

settings = Settings()

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App configuration, overridable via environment variables or backend/.env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Zoom Clone API"
    database_url: str = "sqlite:///./zoom.db"
    # Public URL of the frontend; used to build invite links and for CORS.
    frontend_url: str = "http://localhost:3000"
    cors_origins: list[str] = ["http://localhost:3000"]
    jwt_secret: str = "dev-secret-change-me"
    jwt_expire_minutes: int = 60 * 24 * 7
    # The account treated as logged in when no session exists (see deps.py).
    default_user_email: str = "aryan@zoomclone.dev"


@lru_cache
def get_settings() -> Settings:
    return Settings()

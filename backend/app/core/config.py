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
    jwt_secret: str = "dev-only-secret-change-me-in-production-0123456789"
    jwt_expire_minutes: int = 60 * 24 * 7
    # Session cookie: set COOKIE_SECURE=true when served over HTTPS.
    cookie_secure: bool = False
    # The account treated as logged in when no session exists (see deps.py).
    default_user_email: str = "kartikchopra@demo.dev"

    # Meeting WebSocket / WebRTC
    join_token_minutes: int = 120
    # A live room with nobody left in it ends after this many seconds
    # (a grace period so a refresh doesn't end the meeting).
    empty_room_grace_seconds: float = 30
    stun_urls: list[str] = ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]
    # Optional TURN relay for peers behind strict NATs (needed in production).
    turn_urls: list[str] = []
    turn_username: str | None = None
    turn_credential: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()

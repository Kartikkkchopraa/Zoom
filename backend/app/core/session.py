"""Session cookies: who this browser is signed in as."""

from fastapi import Response

from app.core.config import get_settings
from app.core.security import create_session_token
from app.models import User

SESSION_COOKIE = "zoom_session"
# Marks a browser as signed out / a guest, so it no longer falls back to the default user.
SIGNED_OUT_COOKIE = "zoom_signed_out"


def start_session(response: Response, user: User) -> None:
    settings = get_settings()
    response.set_cookie(
        SESSION_COOKIE,
        create_session_token(user.id),
        max_age=settings.jwt_expire_minutes * 60,
        httponly=True,  # not readable from JavaScript
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )
    response.delete_cookie(SIGNED_OUT_COOKIE, path="/")


def mark_signed_out(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.set_cookie(
        SIGNED_OUT_COOKIE,
        "1",
        max_age=60 * 60 * 24 * 365,
        httponly=True,
        samesite="lax",
        secure=get_settings().cookie_secure,
        path="/",
    )

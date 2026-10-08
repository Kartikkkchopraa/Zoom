from fastapi import APIRouter, Response, status

from app.core.config import get_settings
from app.core.deps import SESSION_COOKIE, SIGNED_OUT_COOKIE, DbSession
from app.core.security import create_session_token
from app.models import User
from app.routers.users import MeOut, build_me
from app.schemas.auth import LoginIn, SignupIn
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _start_session(response: Response, user: User) -> None:
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


@router.post("/signup", response_model=MeOut, status_code=status.HTTP_201_CREATED)
def signup(body: SignupIn, db: DbSession, response: Response):
    user = auth_service.signup(db, body.name, body.email, body.password)
    _start_session(response, user)
    return build_me(db, user)


@router.post("/login", response_model=MeOut)
def login(body: LoginIn, db: DbSession, response: Response):
    user = auth_service.authenticate(db, body.email, body.password)
    _start_session(response, user)
    return build_me(db, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
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

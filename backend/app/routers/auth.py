from fastapi import APIRouter, Request, Response, status

from app.core.deps import DbSession
from app.core.session import SESSION_COOKIE, mark_signed_out, start_session
from app.routers.users import MeOut, build_me
from app.schemas.auth import LoginIn, SignupIn
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=MeOut, status_code=status.HTTP_201_CREATED)
def signup(body: SignupIn, db: DbSession, response: Response):
    user = auth_service.signup(db, body.name, body.email, body.password)
    start_session(response, user)
    return build_me(db, user)


@router.post("/login", response_model=MeOut)
def login(body: LoginIn, db: DbSession, response: Response):
    user = auth_service.authenticate(db, body.email, body.password)
    start_session(response, user)
    return build_me(db, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    mark_signed_out(response)


@router.post("/guest", status_code=status.HTTP_204_NO_CONTENT)
def continue_as_guest(request: Request, response: Response):
    """Called by the invite-link pages: a browser with no session joins as a guest
    instead of silently becoming the default user. Signed-in browsers are untouched."""
    if not request.cookies.get(SESSION_COOKIE):
        mark_signed_out(response)

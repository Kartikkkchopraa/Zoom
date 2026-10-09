from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.core.errors import AppError
from app.core.security import decode_session_token
from app.core.session import SESSION_COOKIE, SIGNED_OUT_COOKIE
from app.models import User

DbSession = Annotated[Session, Depends(get_db)]


def get_optional_user(request: Request, db: DbSession) -> User | None:
    """The signed-in user, or None for a signed-out visitor (e.g. a guest joining by link).

    The assignment assumes a default user is logged in, so a browser that has
    never signed in, signed out or joined as a guest is treated as the seeded
    default user (flagged on request.state so /users/me can turn it into a
    real session).
    """
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        user_id = decode_session_token(token)
        return db.get(User, user_id) if user_id else None
    if request.cookies.get(SIGNED_OUT_COOKIE):
        return None
    user = db.scalar(select(User).where(User.email == get_settings().default_user_email))
    if user is None:
        raise AppError(500, "no_default_user", "Default user missing - run `python -m app.seed`")
    request.state.default_user = True
    return user


def get_current_user(user: Annotated[User | None, Depends(get_optional_user)]) -> User:
    if user is None:
        raise AppError(401, "not_authenticated", "Please sign in to continue")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]

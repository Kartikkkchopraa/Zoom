from typing import Annotated

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.core.errors import AppError
from app.models import User

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(db: DbSession) -> User:
    """The signed-in user.

    The assignment assumes a default user is always logged in, so for now
    this returns the seeded default user. JWT auth is layered on in Phase 8.
    """
    user = db.scalar(select(User).where(User.email == get_settings().default_user_email))
    if user is None:
        raise AppError(500, "no_default_user", "Default user missing - run `python -m app.seed`")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]

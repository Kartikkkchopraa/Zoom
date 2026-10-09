from fastapi import APIRouter, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, DbSession
from app.core.session import start_session
from app.models import User
from app.schemas.meeting import MeetingOut
from app.schemas.user import UserOut, UserSettingsOut, UserSettingsUpdate, UserUpdate
from app.services import meeting_service

router = APIRouter(prefix="/api/users", tags=["users"])


class MeOut(BaseModel):
    user: UserOut
    settings: UserSettingsOut
    personal_meeting: MeetingOut


def build_me(db: Session, user: User) -> MeOut:
    return MeOut(
        user=UserOut.model_validate(user),
        settings=UserSettingsOut.model_validate(user.settings),
        personal_meeting=meeting_service.serialize_many(db, [user.personal_meeting])[0],
    )


@router.get("/me", response_model=MeOut)
def me(db: DbSession, user: CurrentUser, request: Request, response: Response):
    # Opening the app without a session signs this browser in as the default
    # user for real, so invite links opened here later keep that identity.
    if getattr(request.state, "default_user", False):
        start_session(response, user)
    return build_me(db, user)


@router.patch("/me", response_model=MeOut)
def update_me(body: UserUpdate, db: DbSession, user: CurrentUser):
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    return build_me(db, user)


@router.patch("/me/settings", response_model=MeOut)
def update_settings(body: UserSettingsUpdate, db: DbSession, user: CurrentUser):
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(user.settings, field, value)
    db.commit()
    return build_me(db, user)

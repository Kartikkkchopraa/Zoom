from fastapi import APIRouter
from pydantic import BaseModel

from app.core.deps import CurrentUser, DbSession
from app.schemas.meeting import MeetingOut
from app.schemas.user import UserOut, UserSettingsOut
from app.services import meeting_service

router = APIRouter(prefix="/api/users", tags=["users"])


class MeOut(BaseModel):
    user: UserOut
    settings: UserSettingsOut
    personal_meeting: MeetingOut


@router.get("/me", response_model=MeOut)
def me(db: DbSession, user: CurrentUser):
    return MeOut(
        user=UserOut.model_validate(user),
        settings=UserSettingsOut.model_validate(user.settings),
        personal_meeting=meeting_service.serialize_many(db, [user.personal_meeting])[0],
    )

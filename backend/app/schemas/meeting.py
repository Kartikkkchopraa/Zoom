import re
from datetime import datetime
from enum import StrEnum
from typing import Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field

from app.models import MeetingStatus, MeetingType
from app.schemas.user import UserBrief


class MeetingOut(BaseModel):
    id: int
    meeting_code: str
    title: str
    description: str | None
    meeting_type: MeetingType
    status: MeetingStatus
    use_pmi: bool
    scheduled_start: datetime | None
    duration_minutes: int | None
    timezone: str
    passcode: str | None
    invite_link: str
    waiting_room: bool
    mute_on_entry: bool
    host_video: bool
    participant_video: bool
    started_at: datetime | None
    ended_at: datetime | None
    host: UserBrief
    participant_count: int
    invitees: list[str]


class MeetingRoomOut(MeetingOut):
    """Returned after a successful join check; tells the client its role."""

    is_host: bool
    # Short-lived signed proof of this check, presented when opening the meeting WebSocket.
    join_token: str


class MeetingScope(StrEnum):
    UPCOMING = "upcoming"
    PREVIOUS = "previous"


def _validate_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValueError(f"Unknown time zone: {value}") from exc
    return value


def _validate_passcode(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9@*_-]{1,10}", value):
        raise ValueError("Passcode must be 1-10 letters, numbers or @ * _ -")
    return value


TimezoneStr = Annotated[str, AfterValidator(_validate_timezone)]
PasscodeStr = Annotated[str, AfterValidator(_validate_passcode)]


class MeetingCreate(BaseModel):
    """The Schedule Meeting form.

    `start_time` is the wall-clock time the user picked; if it has no offset
    it is interpreted in `timezone` (the form's Time Zone dropdown).
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    start_time: datetime
    duration_minutes: int = Field(ge=15, le=24 * 60)
    timezone: TimezoneStr = "Asia/Kolkata"
    use_pmi: bool = False
    passcode: PasscodeStr | None = None
    waiting_room: bool = False
    mute_on_entry: bool = False
    host_video: bool = True
    participant_video: bool = True
    invitees: list[EmailStr] = Field(default_factory=list, max_length=100)


class MeetingUpdate(BaseModel):
    """Partial update; only provided fields change."""

    model_config = ConfigDict(str_strip_whitespace=True)

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    start_time: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=15, le=24 * 60)
    timezone: TimezoneStr | None = None
    passcode: PasscodeStr | None = None
    waiting_room: bool | None = None
    mute_on_entry: bool | None = None
    host_video: bool | None = None
    participant_video: bool | None = None
    invitees: list[EmailStr] | None = Field(default=None, max_length=100)


class InstantMeetingCreate(BaseModel):
    # "New meeting ▾ → Use my Personal Meeting ID"
    use_pmi: bool = False


class JoinCheck(BaseModel):
    """What the user typed in Join: a meeting ID or an invite link."""

    meeting: str = Field(min_length=1, max_length=500)
    passcode: str | None = Field(default=None, max_length=10)


class InvitationOut(BaseModel):
    text: str

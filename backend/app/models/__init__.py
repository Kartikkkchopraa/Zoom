"""Import every model here so Base.metadata is complete (used by Alembic and tests)."""

from app.models.base import Base
from app.models.meeting import (
    ChatMessage,
    Meeting,
    MeetingInvitee,
    MeetingParticipant,
    MeetingStatus,
    MeetingType,
    ParticipantRole,
)
from app.models.user import User, UserSettings

__all__ = [
    "Base",
    "ChatMessage",
    "Meeting",
    "MeetingInvitee",
    "MeetingParticipant",
    "MeetingStatus",
    "MeetingType",
    "ParticipantRole",
    "User",
    "UserSettings",
]

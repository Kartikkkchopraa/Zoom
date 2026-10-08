"""Database side of a live meeting: attendance, chat, and live/ended status.

Called by the WebSocket layer (app/ws), which owns the in-memory room state.
"""

from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import (
    ChatMessage,
    Meeting,
    MeetingParticipant,
    MeetingStatus,
    MeetingType,
    ParticipantRole,
)
from app.models.base import utcnow
from app.services.meeting_service import end_room


def room_status(db: Session, meeting_id: int) -> tuple[MeetingStatus, MeetingType] | None:
    meeting = db.get(Meeting, meeting_id)
    return (meeting.status, meeting.meeting_type) if meeting else None


def mark_live(db: Session, meeting_id: int) -> None:
    """The host has arrived: the room is live (no-op if it already is)."""
    meeting = db.get(Meeting, meeting_id)
    if meeting and meeting.status is not MeetingStatus.LIVE:
        meeting.status = MeetingStatus.LIVE
        meeting.started_at = utcnow()
        meeting.ended_at = None
        db.commit()


def end_live_room(db: Session, meeting_id: int) -> None:
    meeting = db.get(Meeting, meeting_id)
    if meeting and meeting.status is MeetingStatus.LIVE:
        end_room(db, meeting)


def add_participant(
    db: Session, meeting_id: int, user_id: int | None, name: str, role: ParticipantRole
) -> int:
    participant = MeetingParticipant(
        meeting_id=meeting_id, user_id=user_id, display_name=name, role=role
    )
    db.add(participant)
    db.commit()
    return participant.id


def close_participant(db: Session, participant_id: int, removed: bool = False) -> None:
    participant = db.get(MeetingParticipant, participant_id)
    if participant and participant.left_at is None:
        participant.left_at = utcnow()
        participant.was_removed = removed
        db.commit()


def update_participant(
    db: Session,
    participant_id: int,
    *,
    name: str | None = None,
    role: ParticipantRole | None = None,
) -> None:
    participant = db.get(MeetingParticipant, participant_id)
    if not participant:
        return
    if name is not None:
        participant.display_name = name
    if role is not None:
        participant.role = role
    db.commit()


def save_chat(
    db: Session, meeting_id: int, sender_id: int, recipient_id: int | None, body: str
) -> tuple[int, datetime]:
    message = ChatMessage(
        meeting_id=meeting_id, sender_id=sender_id, recipient_id=recipient_id, body=body
    )
    db.add(message)
    db.commit()
    return message.id, message.sent_at


def end_stale_live_meetings(db: Session) -> int:
    """On startup no rooms exist in memory, so anything still 'live' is stale."""
    stale = db.scalars(select(Meeting).where(Meeting.status == MeetingStatus.LIVE)).all()
    for meeting in stale:
        end_room(db, meeting)
    db.execute(
        update(MeetingParticipant)
        .where(MeetingParticipant.left_at.is_(None))
        .values(left_at=utcnow())
    )
    db.commit()
    return len(stale)

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UTCDateTime, str_enum, utcnow

if TYPE_CHECKING:
    from app.models.user import User


class MeetingType(StrEnum):
    INSTANT = "instant"
    SCHEDULED = "scheduled"
    PERSONAL = "personal"  # the host's Personal Meeting Room (PMI)


class MeetingStatus(StrEnum):
    NOT_STARTED = "not_started"
    LIVE = "live"
    ENDED = "ended"


class ParticipantRole(StrEnum):
    HOST = "host"
    CO_HOST = "co_host"
    ATTENDEE = "attendee"


class Meeting(TimestampMixin, Base):
    __tablename__ = "meetings"
    __table_args__ = (
        # A meeting either owns its code/link, or borrows the host's PMI
        # ("Meeting ID: Personal Meeting ID" in the schedule form).
        CheckConstraint(
            "(use_pmi = 1 AND meeting_code IS NULL AND invite_token IS NULL) OR "
            "(use_pmi = 0 AND meeting_code IS NOT NULL AND invite_token IS NOT NULL)",
            name="ck_meetings_code_or_pmi",
        ),
        CheckConstraint(
            "meeting_type != 'scheduled' OR "
            "(scheduled_start IS NOT NULL AND duration_minutes IS NOT NULL)",
            name="ck_meetings_scheduled_has_time",
        ),
        CheckConstraint(
            "duration_minutes IS NULL OR duration_minutes > 0",
            name="ck_meetings_duration_positive",
        ),
        # One personal room per user.
        Index(
            "uq_meetings_one_personal_per_host",
            "host_id",
            unique=True,
            sqlite_where=text("meeting_type = 'personal'"),
        ),
        Index("ix_meetings_host_start", "host_id", "scheduled_start"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # Zoom-style numeric ID: 11 digits for meetings, 10 for PMIs.
    meeting_code: Mapped[str | None] = mapped_column(String(11), unique=True, index=True)
    host_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    meeting_type: Mapped[MeetingType] = mapped_column(str_enum(MeetingType, "meeting_type"))
    status: Mapped[MeetingStatus] = mapped_column(
        str_enum(MeetingStatus, "meeting_status"), default=MeetingStatus.NOT_STARTED
    )
    use_pmi: Mapped[bool] = mapped_column(Boolean, default=False)

    scheduled_start: Mapped[datetime | None] = mapped_column(UTCDateTime)
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Kolkata")

    passcode: Mapped[str | None] = mapped_column(String(10))
    # Secret embedded in invite links (?pwd=...) so link holders skip the passcode.
    invite_token: Mapped[str | None] = mapped_column(String(64), unique=True)

    waiting_room: Mapped[bool] = mapped_column(Boolean, default=False)
    mute_on_entry: Mapped[bool] = mapped_column(Boolean, default=False)
    host_video: Mapped[bool] = mapped_column(Boolean, default=True)
    participant_video: Mapped[bool] = mapped_column(Boolean, default=True)

    started_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    ended_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    host: Mapped["User"] = relationship(back_populates="hosted_meetings", foreign_keys=[host_id])
    invitees: Mapped[list["MeetingInvitee"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan"
    )
    participants: Mapped[list["MeetingParticipant"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan"
    )
    chat_messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan"
    )


class MeetingInvitee(Base):
    __tablename__ = "meeting_invitees"
    __table_args__ = (UniqueConstraint("meeting_id", "email", name="uq_invitee_per_meeting"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), index=True
    )
    email: Mapped[str] = mapped_column(String(255))
    # Linked when the invitee has an account, so the meeting shows in their Upcoming list.
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    meeting: Mapped[Meeting] = relationship(back_populates="invitees")


class MeetingParticipant(Base):
    """One row per join: the attendance history of a meeting.

    Guests have no user_id; a user rejoining creates a new row.
    """

    __tablename__ = "meeting_participants"
    __table_args__ = (Index("ix_participants_meeting_active", "meeting_id", "left_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    display_name: Mapped[str] = mapped_column(String(100))
    role: Mapped[ParticipantRole] = mapped_column(
        str_enum(ParticipantRole, "participant_role"), default=ParticipantRole.ATTENDEE
    )
    joined_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    left_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    was_removed: Mapped[bool] = mapped_column(Boolean, default=False)

    meeting: Mapped[Meeting] = relationship(back_populates="participants")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (Index("ix_chat_meeting_sent", "meeting_id", "sent_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    sender_id: Mapped[int] = mapped_column(
        ForeignKey("meeting_participants.id", ondelete="CASCADE")
    )
    # NULL = sent to "Meeting Group Chat"; otherwise a private message.
    recipient_id: Mapped[int | None] = mapped_column(
        ForeignKey("meeting_participants.id", ondelete="CASCADE")
    )
    body: Mapped[str] = mapped_column(Text)
    sent_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    meeting: Mapped[Meeting] = relationship(back_populates="chat_messages")
    sender: Mapped[MeetingParticipant] = relationship(foreign_keys=[sender_id])

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.meeting import Meeting


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    avatar_color: Mapped[str] = mapped_column(String(7), default="#2556A8")
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Kolkata")

    settings: Mapped["UserSettings"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    hosted_meetings: Mapped[list["Meeting"]] = relationship(
        back_populates="host",
        cascade="all, delete-orphan",
        foreign_keys="Meeting.host_id",
    )
    # Every user owns exactly one Personal Meeting Room (enforced by a partial
    # unique index on meetings), exposed here as a read-only shortcut.
    personal_meeting: Mapped["Meeting"] = relationship(
        primaryjoin="and_(User.id == Meeting.host_id, Meeting.meeting_type == 'personal')",
        viewonly=True,
        uselist=False,
    )

    @property
    def initials(self) -> str:
        parts = self.name.split()
        return "".join(p[0] for p in parts[:2]).upper() or "?"


class UserSettings(Base):
    """Per-user meeting defaults (1:1 with users)."""

    __tablename__ = "user_settings"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    mute_mic_on_join: Mapped[bool] = mapped_column(Boolean, default=True)
    video_off_on_join: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped[User] = relationship(back_populates="settings")

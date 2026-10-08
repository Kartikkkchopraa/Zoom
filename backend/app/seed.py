"""Seed the database with sample users and meetings.

Usage:
    uv run python -m app.seed           # seed only if the database is empty
    uv run python -m app.seed --reset   # wipe all rows and reseed

Meeting times are relative to "now" so the dashboard always has upcoming
and recent meetings no matter when the seed runs.
"""

import argparse
from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import (
    Base,
    ChatMessage,
    Meeting,
    MeetingInvitee,
    MeetingParticipant,
    MeetingStatus,
    MeetingType,
    ParticipantRole,
    User,
    UserSettings,
)
from app.models.base import utcnow
from app.services.codes import generate_invite_token, generate_meeting_code, generate_passcode
from app.services.meeting_service import create_personal_room

SEED_PASSWORD = "password123"

USERS = [
    # (name, email, avatar colour)
    ("Aryan Chopra", get_settings().default_user_email, "#2556A8"),
    ("Priya Sharma", "priya@zoomclone.dev", "#7B4FD6"),
    ("Rahul Verma", "rahul@zoomclone.dev", "#0E8A6A"),
    ("Neha Gupta", "neha@zoomclone.dev", "#C2410C"),
    ("Arjun Mehta", "arjun@zoomclone.dev", "#B4237A"),
]

# (title, description, starts in (hours), duration (min), host index, invitee indexes)
UPCOMING = [
    ("Daily Standup", "Quick sync on blockers and today's plan.", 1, 15, 0, [1, 2, 3]),
    (
        "Design Review: Meeting Room UI",
        "Walk through the new toolbar and panels.",
        4,
        45,
        0,
        [1, 4],
    ),
    ("1:1 with Priya", None, 26, 30, 1, [0]),
    ("Sprint Planning", "Plan sprint 14 scope and estimates.", 50, 60, 0, [1, 2, 3, 4]),
    ("Client Demo - Acme Corp", "Demo the scheduling flow to Acme.", 74, 40, 2, [0, 3]),
    ("Engineering All-Hands", "Monthly updates from every team.", 122, 60, 3, [0, 1, 2, 4]),
]

# (title, started (hours ago), lasted (min), host index, attendee indexes, chat lines)
PREVIOUS = [
    (
        "Backend Architecture Discussion",
        3,
        42,
        0,
        [1, 2],
        [
            (0, "Let's go with FastAPI WebSockets for signaling."),
            (1, "Agreed, keeps everything in one service."),
            (2, "I'll draft the schema doc after this."),
        ],
    ),
    ("Aryan Chopra's Zoom Meeting", 20, 18, 0, [3], [(3, "Thanks for the quick call!")]),
    (
        "Weekly Product Sync",
        27,
        55,
        1,
        [0, 2, 3, 4],
        [
            (1, "Agenda is in the doc I just shared."),
            (0, "Can we prioritise the join-by-link flow?"),
        ],
    ),
    ("Interview Prep", 48, 30, 0, [4], []),
    ("Retro - Sprint 12", 98, 50, 2, [0, 1, 3], [(2, "Went well: shipped scheduling on time.")]),
    ("Customer Feedback Review", 150, 35, 3, [0, 1], []),
]


def _reset(db: Session) -> None:
    # Delete children before parents so foreign keys are never violated.
    for table in reversed(Base.metadata.sorted_tables):
        db.execute(delete(table))
    db.commit()


def _seed_users(db: Session) -> list[User]:
    password_hash = hash_password(SEED_PASSWORD)
    users = []
    for name, email, color in USERS:
        user = User(name=name, email=email, password_hash=password_hash, avatar_color=color)
        user.settings = UserSettings()
        db.add(user)
        users.append(user)
    db.flush()
    for user in users:
        create_personal_room(db, user)
    db.flush()
    return users


def _seed_upcoming(db: Session, users: list[User]) -> None:
    now = utcnow().replace(second=0, microsecond=0)
    for title, desc, in_hours, duration, host_i, invitee_is in UPCOMING:
        meeting = Meeting(
            meeting_code=generate_meeting_code(db),
            host=users[host_i],
            title=title,
            description=desc,
            meeting_type=MeetingType.SCHEDULED,
            scheduled_start=now + timedelta(hours=in_hours),
            duration_minutes=duration,
            passcode=generate_passcode(),
            invite_token=generate_invite_token(),
        )
        meeting.invitees = [
            MeetingInvitee(email=users[i].email, user_id=users[i].id) for i in invitee_is
        ]
        db.add(meeting)
        db.flush()


def _seed_previous(db: Session, users: list[User]) -> None:
    now = utcnow().replace(second=0, microsecond=0)
    for title, hours_ago, lasted, host_i, attendee_is, chat in PREVIOUS:
        started = now - timedelta(hours=hours_ago)
        ended = started + timedelta(minutes=lasted)
        is_instant = title.endswith("Zoom Meeting")
        meeting = Meeting(
            meeting_code=generate_meeting_code(db),
            host=users[host_i],
            title=title,
            meeting_type=MeetingType.INSTANT if is_instant else MeetingType.SCHEDULED,
            status=MeetingStatus.ENDED,
            scheduled_start=None if is_instant else started,
            duration_minutes=None if is_instant else lasted,
            passcode=generate_passcode(),
            invite_token=generate_invite_token(),
            started_at=started,
            ended_at=ended,
        )
        db.add(meeting)
        db.flush()

        participants: dict[int, MeetingParticipant] = {}
        for offset, user_i in enumerate([host_i, *attendee_is]):
            participants[user_i] = MeetingParticipant(
                meeting=meeting,
                user_id=users[user_i].id,
                display_name=users[user_i].name,
                role=ParticipantRole.HOST if user_i == host_i else ParticipantRole.ATTENDEE,
                joined_at=started + timedelta(minutes=offset),
                left_at=ended,
            )
        db.add_all(participants.values())
        db.flush()

        for n, (sender_i, body) in enumerate(chat):
            db.add(
                ChatMessage(
                    meeting=meeting,
                    sender_id=participants[sender_i].id,
                    body=body,
                    sent_at=started + timedelta(minutes=2 + n * 3),
                )
            )


def seed(reset: bool = False) -> bool:
    """Returns True if data was written."""
    with SessionLocal() as db:
        if reset:
            _reset(db)
        elif db.scalar(select(User.id).limit(1)):
            return False
        users = _seed_users(db)
        _seed_upcoming(db, users)
        _seed_previous(db, users)
        db.commit()
        return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--reset", action="store_true", help="wipe all rows before seeding")
    args = parser.parse_args()
    if seed(reset=args.reset):
        print(
            f"Seeded {len(USERS)} users, {len(UPCOMING)} upcoming "
            f"and {len(PREVIOUS)} previous meetings."
        )
        print(f"Default user: {USERS[0][1]} / {SEED_PASSWORD}")
    else:
        print("Database already has data; use --reset to reseed.")

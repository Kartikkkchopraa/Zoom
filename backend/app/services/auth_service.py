import secrets

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.security import hash_password, verify_password
from app.models import MeetingInvitee, User, UserSettings
from app.services.meeting_service import create_personal_room

# Zoom-like avatar colours for new accounts.
AVATAR_COLORS = ["#27539C", "#7B4FD6", "#0E8A6A", "#C2410C", "#B4237A", "#0E7490", "#9A3412"]


def signup(db: Session, name: str, email: str, password: str) -> User:
    email = email.lower()
    if db.scalar(select(User.id).where(func.lower(User.email) == email)):
        raise AppError(409, "email_taken", "An account with this email already exists")

    user = User(
        name=name,
        email=email,
        password_hash=hash_password(password),
        avatar_color=secrets.choice(AVATAR_COLORS),
    )
    user.settings = UserSettings()
    db.add(user)
    try:
        db.flush()
    except IntegrityError as exc:  # lost a race with another signup
        db.rollback()
        raise AppError(409, "email_taken", "An account with this email already exists") from exc
    create_personal_room(db, user)
    # Meetings this email was already invited to now show in their Upcoming list.
    for invite in db.scalars(select(MeetingInvitee).where(MeetingInvitee.email == email)):
        invite.user_id = user.id
    db.commit()
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    user = db.scalar(select(User).where(func.lower(User.email) == email.lower()))
    if user is None or not verify_password(password, user.password_hash):
        raise AppError(401, "invalid_credentials", "Incorrect email or password")
    return user

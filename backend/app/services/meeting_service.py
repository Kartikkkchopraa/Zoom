"""Business logic for meetings. Routers stay thin and call into here."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import String, case, cast, func, literal, or_, select, update
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.core.errors import AppError, BadRequestError, ForbiddenError, NotFoundError
from app.core.security import create_join_token
from app.models import (
    Meeting,
    MeetingInvitee,
    MeetingParticipant,
    MeetingStatus,
    MeetingType,
    User,
)
from app.models.base import utcnow
from app.schemas.meeting import (
    MeetingCreate,
    MeetingOut,
    MeetingRoomOut,
    MeetingScope,
    MeetingUpdate,
)
from app.schemas.user import UserBrief
from app.services.codes import (
    PMI_LENGTH,
    format_meeting_code,
    generate_invite_token,
    generate_meeting_code,
    generate_passcode,
    parse_join_input,
)

# How far in the past a scheduled meeting may start (lets users pick "now").
_START_GRACE = timedelta(minutes=5)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def room_of(meeting: Meeting) -> Meeting:
    """The meeting that owns the code/passcode/link: itself, or the host's PMI room."""
    return meeting.host.personal_meeting if meeting.use_pmi else meeting


def invite_link(meeting: Meeting) -> str:
    room = room_of(meeting)
    return f"{get_settings().frontend_url}/j/{room.meeting_code}?pwd={room.invite_token}"


def _to_utc(value: datetime, tz_name: str) -> datetime:
    """Interpret a naive wall-clock time in tz_name; pass aware times through."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=ZoneInfo(tz_name))
    return value.astimezone(ZoneInfo("UTC"))


def _ensure_not_past(start: datetime) -> None:
    if start < utcnow() - _START_GRACE:
        raise BadRequestError("start_in_past", "Meeting start time can't be in the past")


def _participant_counts(db: Session, meeting_ids: list[int]) -> dict[int, int]:
    if not meeting_ids:
        return {}
    # Count people, not join sessions: a rejoin creates a new participant row.
    # Users are identified by id, guests by display name.
    person = case(
        (
            MeetingParticipant.user_id.is_not(None),
            literal("u:") + cast(MeetingParticipant.user_id, String),
        ),
        else_=literal("g:") + MeetingParticipant.display_name,
    )
    rows = db.execute(
        select(MeetingParticipant.meeting_id, func.count(func.distinct(person)))
        .where(MeetingParticipant.meeting_id.in_(meeting_ids))
        .group_by(MeetingParticipant.meeting_id)
    )
    return {meeting_id: count for meeting_id, count in rows}


def serialize(meeting: Meeting, participant_count: int = 0) -> MeetingOut:
    room = room_of(meeting)
    return MeetingOut(
        id=meeting.id,
        meeting_code=room.meeting_code,
        title=meeting.title,
        description=meeting.description,
        meeting_type=meeting.meeting_type,
        status=meeting.status,
        use_pmi=meeting.use_pmi,
        scheduled_start=meeting.scheduled_start,
        duration_minutes=meeting.duration_minutes,
        timezone=meeting.timezone,
        passcode=room.passcode,
        invite_link=invite_link(meeting),
        waiting_room=meeting.waiting_room,
        mute_on_entry=meeting.mute_on_entry,
        host_video=meeting.host_video,
        participant_video=meeting.participant_video,
        started_at=meeting.started_at,
        ended_at=meeting.ended_at,
        host=UserBrief.model_validate(meeting.host),
        participant_count=participant_count,
        invitees=[i.email for i in meeting.invitees],
    )


def serialize_many(db: Session, meetings: list[Meeting]) -> list[MeetingOut]:
    counts = _participant_counts(db, [m.id for m in meetings])
    return [serialize(m, counts.get(m.id, 0)) for m in meetings]


def _base_query():
    return select(Meeting).options(
        selectinload(Meeting.host).selectinload(User.personal_meeting),
        selectinload(Meeting.invitees),
    )


def _visible_to(user: User):
    """Meetings the user hosts, was invited to, or attended."""
    invited = select(MeetingInvitee.meeting_id).where(MeetingInvitee.user_id == user.id)
    attended = select(MeetingParticipant.meeting_id).where(MeetingParticipant.user_id == user.id)
    return or_(
        Meeting.host_id == user.id,
        Meeting.id.in_(invited),
        Meeting.id.in_(attended),
    )


def _get_hosted(db: Session, user: User, meeting_id: int) -> Meeting:
    meeting = db.scalar(_base_query().where(Meeting.id == meeting_id))
    if meeting is None:
        raise NotFoundError("meeting_not_found", "Meeting not found")
    if meeting.host_id != user.id:
        raise ForbiddenError("not_host", "Only the host can do this")
    return meeting


def _set_invitees(db: Session, meeting: Meeting, emails: list[str]) -> None:
    unique = sorted({e.lower() for e in emails})
    users = {
        u.email.lower(): u.id
        for u in db.scalars(select(User).where(func.lower(User.email).in_(unique)))
    }
    # Diff instead of replacing the list: the unit of work inserts new rows
    # before deleting orphans, so re-adding an existing email would violate
    # the (meeting_id, email) unique constraint.
    existing = {i.email: i for i in meeting.invitees}
    meeting.invitees = [
        existing.get(e) or MeetingInvitee(email=e, user_id=users.get(e)) for e in unique
    ]


# --------------------------------------------------------------------------- #
# Queries
# --------------------------------------------------------------------------- #


def get_meeting(db: Session, user: User, meeting_id: int) -> MeetingOut:
    meeting = db.scalar(_base_query().where(Meeting.id == meeting_id, _visible_to(user)))
    if meeting is None:
        raise NotFoundError("meeting_not_found", "Meeting not found")
    return serialize_many(db, [meeting])[0]


def list_meetings(db: Session, user: User, scope: MeetingScope, limit: int) -> list[MeetingOut]:
    now = utcnow()
    if scope is MeetingScope.UPCOMING:
        candidates = db.scalars(
            _base_query()
            .where(
                _visible_to(user),
                Meeting.meeting_type == MeetingType.SCHEDULED,
                Meeting.status != MeetingStatus.ENDED,
                # Max duration is 24h, so anything older can't still be running.
                Meeting.scheduled_start >= now - timedelta(days=1),
            )
            .order_by(Meeting.scheduled_start)
        ).all()
        meetings = [
            m for m in candidates if m.scheduled_start + timedelta(minutes=m.duration_minutes) > now
        ][:limit]
    else:
        meetings = db.scalars(
            _base_query()
            .where(
                _visible_to(user),
                Meeting.started_at.is_not(None),
                Meeting.status != MeetingStatus.LIVE,
            )
            .order_by(Meeting.started_at.desc())
            .limit(limit)
        ).all()
    return serialize_many(db, list(meetings))


def calendar(db: Session, user: User, start: datetime, end: datetime) -> list[MeetingOut]:
    """Meetings scheduled for, or held during, [start, end) — the Home day view."""
    when = func.coalesce(Meeting.scheduled_start, Meeting.started_at)
    meetings = db.scalars(
        _base_query().where(_visible_to(user), when >= start, when < end).order_by(when)
    ).all()
    return serialize_many(db, list(meetings))


# --------------------------------------------------------------------------- #
# Commands
# --------------------------------------------------------------------------- #


def create_personal_room(db: Session, user: User) -> Meeting:
    room = Meeting(
        meeting_code=generate_meeting_code(db, PMI_LENGTH),
        host=user,
        title=f"{user.name}'s Personal Meeting Room",
        meeting_type=MeetingType.PERSONAL,
        timezone=user.timezone,
        passcode=generate_passcode(),
        invite_token=generate_invite_token(),
    )
    db.add(room)
    return room


def create_instant(db: Session, user: User, use_pmi: bool) -> MeetingOut:
    if use_pmi:
        return start_meeting(db, user, user.personal_meeting.id)

    meeting = Meeting(
        meeting_code=generate_meeting_code(db),
        host=user,
        title=f"{user.name}'s Zoom Meeting",
        meeting_type=MeetingType.INSTANT,
        status=MeetingStatus.LIVE,
        timezone=user.timezone,
        passcode=generate_passcode(),
        invite_token=generate_invite_token(),
        started_at=utcnow(),
    )
    db.add(meeting)
    db.commit()
    return serialize(meeting)


def schedule(db: Session, user: User, data: MeetingCreate) -> MeetingOut:
    start = _to_utc(data.start_time, data.timezone)
    _ensure_not_past(start)

    meeting = Meeting(
        host=user,
        title=data.title,
        description=data.description or None,
        meeting_type=MeetingType.SCHEDULED,
        scheduled_start=start,
        duration_minutes=data.duration_minutes,
        timezone=data.timezone,
        use_pmi=data.use_pmi,
        waiting_room=data.waiting_room,
        mute_on_entry=data.mute_on_entry,
        host_video=data.host_video,
        participant_video=data.participant_video,
    )
    if not data.use_pmi:
        meeting.meeting_code = generate_meeting_code(db)
        meeting.passcode = data.passcode or generate_passcode()
        meeting.invite_token = generate_invite_token()
    _set_invitees(db, meeting, data.invitees)
    db.add(meeting)
    db.commit()
    return serialize(meeting)


def update_meeting(db: Session, user: User, meeting_id: int, data: MeetingUpdate) -> MeetingOut:
    meeting = _get_hosted(db, user, meeting_id)
    if meeting.meeting_type is MeetingType.INSTANT:
        raise BadRequestError("not_editable", "Instant meetings can't be edited")

    changes = data.model_dump(exclude_unset=True)
    if (
        meeting.meeting_type is MeetingType.PERSONAL
        and {"start_time", "duration_minutes"} & changes.keys()
    ):
        raise BadRequestError("not_schedulable", "The personal meeting room has no schedule")
    if meeting.use_pmi and "passcode" in changes:
        raise BadRequestError("pmi_passcode", "Edit the passcode on your Personal Meeting ID")

    if "invitees" in changes:
        _set_invitees(db, meeting, changes.pop("invitees") or [])
    if "timezone" in changes:
        meeting.timezone = changes.pop("timezone")
    if "start_time" in changes:
        start = _to_utc(changes.pop("start_time"), meeting.timezone)
        # The edit form always resends the time; only validate an actual change.
        if start != meeting.scheduled_start:
            _ensure_not_past(start)
        meeting.scheduled_start = start
    if "passcode" in changes:
        # Clearing the passcode is not allowed, matching Zoom's enforced passcodes.
        meeting.passcode = changes.pop("passcode") or meeting.passcode
    for field, value in changes.items():
        setattr(meeting, field, value)

    db.commit()
    return serialize_many(db, [meeting])[0]


def delete_meeting(db: Session, user: User, meeting_id: int) -> None:
    meeting = _get_hosted(db, user, meeting_id)
    if meeting.meeting_type is MeetingType.PERSONAL:
        raise BadRequestError("not_deletable", "The personal meeting room can't be deleted")
    if meeting.status is MeetingStatus.LIVE:
        raise BadRequestError("meeting_live", "End the meeting before deleting it")
    db.delete(meeting)
    db.commit()


def start_meeting(db: Session, user: User, meeting_id: int) -> MeetingOut:
    meeting = _get_hosted(db, user, meeting_id)
    now = utcnow()
    for m in {meeting, room_of(meeting)}:
        if m.status is not MeetingStatus.LIVE:
            m.status = MeetingStatus.LIVE
            m.started_at = now
            m.ended_at = None
    db.commit()
    return serialize_many(db, [meeting])[0]


def end_meeting(db: Session, user: User, meeting_id: int) -> MeetingOut:
    meeting = _get_hosted(db, user, meeting_id)
    end_room(db, meeting)
    return serialize_many(db, [meeting])[0]


def end_room(db: Session, meeting: Meeting) -> str:
    """End a meeting and everything sharing its room; returns the room's code.

    Used by the host's "End Meeting for All" and when a live room empties.
    """
    room = room_of(meeting)
    now = utcnow()

    # Everything sharing this room's code ends together: the room itself plus,
    # for a PMI, any live scheduled meetings that borrowed it.
    to_end = {meeting, room}
    if room.meeting_type is MeetingType.PERSONAL:
        to_end.update(
            db.scalars(
                select(Meeting).where(
                    Meeting.host_id == room.host_id,
                    Meeting.use_pmi.is_(True),
                    Meeting.status == MeetingStatus.LIVE,
                )
            )
        )
    for m in to_end:
        if m.status is MeetingStatus.LIVE:
            # The personal room is reusable, so it goes back to "not started".
            m.status = (
                MeetingStatus.NOT_STARTED
                if m.meeting_type is MeetingType.PERSONAL
                else MeetingStatus.ENDED
            )
            m.ended_at = now

    db.execute(
        update(MeetingParticipant)
        .where(
            MeetingParticipant.meeting_id.in_([m.id for m in to_end]),
            MeetingParticipant.left_at.is_(None),
        )
        .values(left_at=now)
    )
    db.commit()
    return room.meeting_code


def join_check(db: Session, user: User, raw: str, passcode: str | None) -> MeetingRoomOut:
    """Validate a Join attempt; returns the room the client should enter."""
    parsed = parse_join_input(raw)
    if parsed is None:
        raise BadRequestError(
            "invalid_meeting_id", "Invalid meeting ID. Please check and try again."
        )

    room = db.scalar(_base_query().where(Meeting.meeting_code == parsed.meeting_code))
    if room is None:
        raise NotFoundError(
            "meeting_not_found", "This meeting ID is not valid. Please check and try again."
        )
    if room.meeting_type is MeetingType.INSTANT and room.status is MeetingStatus.ENDED:
        raise AppError(410, "meeting_ended", "This meeting has been ended by host")

    is_host = room.host_id == user.id
    has_valid_link = parsed.invite_token is not None and parsed.invite_token == room.invite_token
    if room.passcode and not (is_host or has_valid_link):
        if not passcode:
            raise ForbiddenError("passcode_required", "Please enter the meeting passcode")
        if passcode != room.passcode:
            raise ForbiddenError("wrong_passcode", "Incorrect meeting passcode. Please try again.")

    out = serialize_many(db, [room])[0]
    token = create_join_token(
        meeting_id=room.id, code=room.meeting_code, user_id=user.id, can_host=is_host
    )
    return MeetingRoomOut(**out.model_dump(), is_host=is_host, join_token=token)


def invitation_text(db: Session, user: User, meeting_id: int) -> str:
    meeting = db.scalar(_base_query().where(Meeting.id == meeting_id, _visible_to(user)))
    if meeting is None:
        raise NotFoundError("meeting_not_found", "Meeting not found")
    room = room_of(meeting)

    lines = [f"{meeting.host.name} is inviting you to a scheduled Zoom meeting.", ""]
    lines.append(f"Topic: {meeting.title}")
    if meeting.scheduled_start:
        tz = ZoneInfo(meeting.timezone)
        local = meeting.scheduled_start.astimezone(tz)
        lines.append(f"Time: {local:%b %d, %Y %I:%M %p} {meeting.timezone}")
    lines += [
        "",
        "Join Zoom Meeting",
        invite_link(meeting),
        "",
        f"Meeting ID: {format_meeting_code(room.meeting_code)}",
        f"Passcode: {room.passcode}",
    ]
    return "\n".join(lines)

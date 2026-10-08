from datetime import datetime

from fastapi import APIRouter, Query, status
from starlette.concurrency import run_in_threadpool

from app.core.deps import CurrentUser, DbSession, OptionalUser
from app.schemas.meeting import (
    InstantMeetingCreate,
    InvitationOut,
    JoinCheck,
    MeetingCreate,
    MeetingOut,
    MeetingRoomOut,
    MeetingScope,
    MeetingUpdate,
)
from app.services import meeting_service
from app.ws.room import manager

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


@router.get("", response_model=list[MeetingOut])
def list_meetings(
    db: DbSession,
    user: CurrentUser,
    scope: MeetingScope = MeetingScope.UPCOMING,
    limit: int = Query(50, ge=1, le=200),
):
    """Upcoming scheduled meetings, or previous (already held) meetings."""
    return meeting_service.list_meetings(db, user, scope, limit)


@router.get("/calendar", response_model=list[MeetingOut])
def calendar(db: DbSession, user: CurrentUser, start: datetime, end: datetime):
    """Meetings in a time window, for the Home day view. Pass ISO times with offsets."""
    return meeting_service.calendar(db, user, start, end)


@router.post("/instant", response_model=MeetingOut, status_code=status.HTTP_201_CREATED)
def create_instant(db: DbSession, user: CurrentUser, body: InstantMeetingCreate | None = None):
    return meeting_service.create_instant(db, user, use_pmi=bool(body and body.use_pmi))


@router.post("", response_model=MeetingOut, status_code=status.HTTP_201_CREATED)
def schedule(db: DbSession, user: CurrentUser, body: MeetingCreate):
    return meeting_service.schedule(db, user, body)


@router.post("/join-check", response_model=MeetingRoomOut)
def join_check(db: DbSession, user: OptionalUser, body: JoinCheck):
    """Validate a meeting ID or invite link (and passcode) before joining."""
    return meeting_service.join_check(db, user, body.meeting, body.passcode)


@router.get("/{meeting_id}", response_model=MeetingOut)
def get_meeting(db: DbSession, user: CurrentUser, meeting_id: int):
    return meeting_service.get_meeting(db, user, meeting_id)


@router.patch("/{meeting_id}", response_model=MeetingOut)
def update_meeting(db: DbSession, user: CurrentUser, meeting_id: int, body: MeetingUpdate):
    return meeting_service.update_meeting(db, user, meeting_id, body)


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(db: DbSession, user: CurrentUser, meeting_id: int):
    meeting_service.delete_meeting(db, user, meeting_id)


@router.get("/{meeting_id}/invitation", response_model=InvitationOut)
def invitation(db: DbSession, user: CurrentUser, meeting_id: int):
    return InvitationOut(text=meeting_service.invitation_text(db, user, meeting_id))


@router.post("/{meeting_id}/start", response_model=MeetingOut)
def start(db: DbSession, user: CurrentUser, meeting_id: int):
    return meeting_service.start_meeting(db, user, meeting_id)


@router.post("/{meeting_id}/end", response_model=MeetingOut)
async def end(db: DbSession, user: CurrentUser, meeting_id: int):
    """End Meeting for All: closes the meeting and disconnects everyone in it."""
    ended = await run_in_threadpool(meeting_service.end_meeting, db, user, meeting_id)
    await manager.end(ended.meeting_code)
    return ended

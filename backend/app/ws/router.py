import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.core.security import decode_join_token
from app.models import MeetingStatus, MeetingType, ParticipantRole
from app.services import live_service as live
from app.ws.protocol import (
    ChatMsg,
    JoinMsg,
    LeaveMsg,
    ReactionMsg,
    RenameMsg,
    SignalMsg,
    StateMsg,
    client_message,
)
from app.ws.room import Peer, manager

router = APIRouter()


async def _reject(ws: WebSocket, code: str, message: str) -> None:
    await ws.send_json({"type": "error", "code": code, "message": message})
    await ws.close(code=4000)


@router.websocket("/ws/meetings/{code}")
async def meeting_socket(ws: WebSocket, code: str) -> None:
    """One connection per participant.

    The first message must be `join` with the token from the join check;
    after that the socket carries signaling, state, chat and reactions.
    """
    await ws.accept()
    try:
        first = client_message.validate_python(await ws.receive_json())
    except (ValidationError, ValueError, WebSocketDisconnect):
        return await _reject(ws, "bad_join", "The first message must be a join")
    if not isinstance(first, JoinMsg):
        return await _reject(ws, "bad_join", "The first message must be a join")

    claims = decode_join_token(first.token)
    if claims is None or claims.code != code:
        return await _reject(ws, "invalid_token", "Your join link has expired. Please rejoin.")
    status = await manager.db.run(live.room_status, claims.meeting_id)
    if status is None:
        return await _reject(ws, "meeting_not_found", "This meeting no longer exists")
    db_status, meeting_type = status
    if meeting_type is MeetingType.INSTANT and db_status is MeetingStatus.ENDED:
        return await _reject(ws, "meeting_ended", "This meeting has been ended by host")

    is_host = first.as_host and claims.can_host
    peer = Peer(
        ws=ws,
        name=first.name,
        role=ParticipantRole.HOST if is_host else ParticipantRole.ATTENDEE,
        user_id=claims.user_id,
        state=first.state,
    )
    room = manager.room(code, claims.meeting_id)

    handlers = {
        SignalMsg: manager.on_signal,
        StateMsg: manager.on_state,
        ChatMsg: manager.on_chat,
        ReactionMsg: manager.on_reaction,
        RenameMsg: manager.on_rename,
    }
    try:
        await manager.join(room, peer, db_status)
        while True:
            try:
                msg = client_message.validate_python(await ws.receive_json())
            except (ValidationError, ValueError):
                await manager.error(peer, "bad_message", "Malformed message")
                continue
            if isinstance(msg, LeaveMsg):
                break
            handler = handlers.get(type(msg))
            # Nothing but `leave` is accepted until the peer is admitted.
            if handler and peer.admitted:
                await handler(room, peer, msg)
    except (WebSocketDisconnect, RuntimeError):
        # RuntimeError: the server closed this socket (meeting ended) mid-receive.
        pass
    finally:
        # Shielded so cleanup (attendance row, peer_left broadcast) always
        # completes even if this handler is cancelled mid-disconnect.
        await asyncio.shield(manager.leave(room, peer))

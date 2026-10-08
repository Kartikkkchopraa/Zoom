"""In-memory state of live meetings and the logic for each WebSocket message.

One process owns every room (SQLite + a single backend instance), so a plain
dict is enough. Scaling out would move this state to Redis pub/sub.
"""

import asyncio
import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from fastapi import WebSocket
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.models import MeetingStatus, ParticipantRole
from app.services import live_service as live
from app.ws.protocol import ChatMsg, PeerState, ReactionMsg, RenameMsg, SignalMsg, StateMsg

log = logging.getLogger(__name__)


class Db:
    """Runs blocking SQLAlchemy work off the event loop, one session per call."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self.session_factory = session_factory

    async def run(self, fn: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
        def call():
            with self.session_factory() as db:
                return fn(db, *args, **kwargs)

        return await run_in_threadpool(call)


@dataclass(eq=False)
class Peer:
    ws: WebSocket
    name: str
    role: ParticipantRole
    user_id: int | None
    state: PeerState
    id: str = field(default_factory=lambda: uuid4().hex[:12])
    participant_id: int | None = None  # meeting_participants row, once admitted
    admitted: bool = False

    def public(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "participant_id": self.participant_id,
            "name": self.name,
            "role": self.role.value,
            **self.state.model_dump(),
        }


def default_room_settings() -> dict[str, bool]:
    return {
        "locked": False,
        "waiting_room": False,
        "allow_share": True,
        "allow_chat": True,
        "allow_rename": True,
        "allow_unmute": True,
    }


@dataclass(eq=False)
class Room:
    code: str
    meeting_id: int
    peers: dict[str, Peer] = field(default_factory=dict)
    # Joined before the host started the meeting ("Waiting for host").
    waiting_for_host: dict[str, Peer] = field(default_factory=dict)
    settings: dict[str, bool] = field(default_factory=default_room_settings)
    live: bool = False
    ended: bool = False
    empty_timer: asyncio.Task | None = None

    def cancel_empty_timer(self) -> None:
        if self.empty_timer:
            self.empty_timer.cancel()
            self.empty_timer = None


class RoomManager:
    def __init__(self) -> None:
        self.rooms: dict[str, Room] = {}
        self.db: Db | None = None
        self.empty_grace = get_settings().empty_room_grace_seconds

    def configure(self, session_factory: Callable[[], Session]) -> None:
        self.db = Db(session_factory)

    def room(self, code: str, meeting_id: int) -> Room:
        room = self.rooms.get(code)
        if room is None or room.ended:
            room = self.rooms[code] = Room(code=code, meeting_id=meeting_id)
        return room

    # ---- sending ---------------------------------------------------------- #

    async def send(self, peer: Peer, message: dict[str, Any]) -> None:
        try:
            await peer.ws.send_json(message)
        except Exception:  # the socket is closing; its own handler cleans up
            log.debug("send to %s failed", peer.id)

    async def broadcast(
        self, room: Room, message: dict[str, Any], exclude: Peer | None = None
    ) -> None:
        await asyncio.gather(
            *(self.send(p, message) for p in room.peers.values() if p is not exclude)
        )

    async def error(self, peer: Peer, code: str, message: str) -> None:
        await self.send(peer, {"type": "error", "code": code, "message": message})

    # ---- membership ------------------------------------------------------- #

    async def join(self, room: Room, peer: Peer, db_status: MeetingStatus) -> None:
        if peer.role is ParticipantRole.HOST:
            if not room.live:
                await self.db.run(live.mark_live, room.meeting_id)
                room.live = True
            await self._admit(room, peer)
            # The host's arrival lets everyone who was waiting in.
            waiting = list(room.waiting_for_host.values())
            room.waiting_for_host.clear()
            for p in waiting:
                await self._admit(room, p)
        elif room.live or db_status is MeetingStatus.LIVE:
            room.live = True
            await self._admit(room, peer)
        else:
            room.waiting_for_host[peer.id] = peer
            await self.send(peer, {"type": "waiting_for_host"})

    async def _admit(self, room: Room, peer: Peer) -> None:
        peer.participant_id = await self.db.run(
            live.add_participant, room.meeting_id, peer.user_id, peer.name, peer.role
        )
        peer.admitted = True
        room.peers[peer.id] = peer
        room.cancel_empty_timer()
        await self.send(
            peer,
            {
                "type": "welcome",
                "self": peer.public(),
                "peers": [p.public() for p in room.peers.values() if p is not peer],
                "settings": room.settings,
            },
        )
        await self.broadcast(room, {"type": "peer_joined", "peer": peer.public()}, exclude=peer)

    async def leave(self, room: Room, peer: Peer, removed: bool = False) -> None:
        room.waiting_for_host.pop(peer.id, None)
        if room.peers.pop(peer.id, None) is not None:
            await self.db.run(live.close_participant, peer.participant_id, removed)
            if not room.ended:
                await self.broadcast(room, {"type": "peer_left", "peer_id": peer.id})
        if room.ended or room.peers:
            return
        if room.live:
            room.cancel_empty_timer()
            room.empty_timer = asyncio.create_task(self._end_when_empty(room))
        elif not room.waiting_for_host:
            self.rooms.pop(room.code, None)

    async def _end_when_empty(self, room: Room) -> None:
        await asyncio.sleep(self.empty_grace)
        if room.peers or room.ended:
            return
        await self.db.run(live.end_live_room, room.meeting_id)
        await self.end(room.code, reason="empty")

    async def end(self, code: str, reason: str = "ended_by_host") -> None:
        """Tell everyone the meeting is over and close their sockets."""
        room = self.rooms.pop(code, None)
        if room is None:
            return
        room.ended = True
        room.cancel_empty_timer()
        everyone = [*room.peers.values(), *room.waiting_for_host.values()]
        for peer in everyone:
            await self.send(peer, {"type": "meeting_ended", "reason": reason})
        for peer in everyone:
            try:
                await peer.ws.close()
            except Exception:
                log.debug("close of %s failed", peer.id)

    # ---- in-meeting messages ---------------------------------------------- #

    async def on_signal(self, room: Room, peer: Peer, msg: SignalMsg) -> None:
        target = room.peers.get(msg.to)
        if target:
            await self.send(target, {"type": "signal", "from": peer.id, "data": msg.data})

    async def on_state(self, room: Room, peer: Peer, msg: StateMsg) -> None:
        patch = msg.patch.model_dump(exclude_none=True)
        if patch.get("sharing") and not peer.state.sharing:
            if refusal := self._share_refusal(room, peer):
                # Keep the rest of the update; the client stops its share on this error.
                patch.pop("sharing")
                await self.error(peer, *refusal)
        if not patch:
            return
        peer.state = peer.state.model_copy(update=patch)
        await self.broadcast(
            room, {"type": "peer_updated", "peer_id": peer.id, "patch": patch}, exclude=peer
        )

    def _share_refusal(self, room: Room, peer: Peer) -> tuple[str, str] | None:
        """Why this peer may not start sharing, or None if they may."""
        if peer.role is ParticipantRole.ATTENDEE and not room.settings["allow_share"]:
            return "share_disabled", "The host has disabled screen sharing"
        sharer = next((p for p in room.peers.values() if p.state.sharing and p is not peer), None)
        if sharer:
            return "share_in_use", f"{sharer.name} is already sharing their screen"
        return None

    async def on_chat(self, room: Room, peer: Peer, msg: ChatMsg) -> None:
        if peer.role is ParticipantRole.ATTENDEE and not room.settings["allow_chat"]:
            return await self.error(peer, "chat_disabled", "The host has disabled chat")
        target = room.peers.get(msg.to) if msg.to else None
        if msg.to and target is None:
            return await self.error(peer, "recipient_left", "That participant has left the meeting")

        message_id, sent_at = await self.db.run(
            live.save_chat,
            room.meeting_id,
            peer.participant_id,
            target.participant_id if target else None,
            msg.body,
        )
        payload = {
            "type": "chat",
            "message": {
                "id": message_id,
                "sender_id": peer.id,
                "sender_name": peer.name,
                "recipient_id": target.id if target else None,
                "recipient_name": target.name if target else None,
                "body": msg.body,
                "sent_at": sent_at.isoformat(),
            },
        }
        if target:  # direct message: only the two people involved see it
            await asyncio.gather(self.send(target, payload), self.send(peer, payload))
        else:
            await self.broadcast(room, payload)

    async def on_reaction(self, room: Room, peer: Peer, msg: ReactionMsg) -> None:
        await self.broadcast(room, {"type": "reaction", "peer_id": peer.id, "emoji": msg.emoji})

    async def on_rename(self, room: Room, peer: Peer, msg: RenameMsg) -> None:
        if peer.role is ParticipantRole.ATTENDEE and not room.settings["allow_rename"]:
            return await self.error(peer, "rename_disabled", "The host has disabled renaming")
        peer.name = msg.name
        await self.db.run(live.update_participant, peer.participant_id, name=msg.name)
        await self.broadcast(
            room, {"type": "peer_updated", "peer_id": peer.id, "patch": {"name": msg.name}}
        )


manager = RoomManager()

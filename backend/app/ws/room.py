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
from app.ws.protocol import (
    AdmitMsg,
    AskUnmuteMsg,
    ChatMsg,
    DenyMsg,
    MuteAllMsg,
    MuteMsg,
    PeerState,
    ReactionMsg,
    RemoveMsg,
    RenameMsg,
    SetRoleMsg,
    SettingsMsg,
    SignalMsg,
    StateMsg,
)

log = logging.getLogger(__name__)

HOST = ParticipantRole.HOST
CO_HOST = ParticipantRole.CO_HOST
ATTENDEE = ParticipantRole.ATTENDEE


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
    client_id: str | None = None
    id: str = field(default_factory=lambda: uuid4().hex[:12])
    participant_id: int | None = None  # meeting_participants row, once admitted
    admitted: bool = False
    # The host asked this attendee to unmute, so one unmute is allowed even
    # when "Allow participants to unmute themselves" is off.
    unmute_invited: bool = False
    removed: bool = False

    @property
    def is_moderator(self) -> bool:
        return self.role in (HOST, CO_HOST)

    def public(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "participant_id": self.participant_id,
            "name": self.name,
            "role": self.role.value,
            **self.state.model_dump(),
        }


def default_room_settings(waiting_room: bool = False) -> dict[str, bool]:
    return {
        "locked": False,
        "waiting_room": waiting_room,
        "allow_share": True,
        "allow_chat": True,
        "allow_rename": True,
        "allow_unmute": True,
    }


@dataclass(eq=False)
class Room:
    code: str
    meeting_id: int
    settings: dict[str, bool]
    peers: dict[str, Peer] = field(default_factory=dict)
    # Joined before the host started the meeting ("Please wait for the host").
    waiting_for_host: dict[str, Peer] = field(default_factory=dict)
    # Held in the waiting room until a host/co-host admits them.
    waiting_room: dict[str, Peer] = field(default_factory=dict)
    # Browsers the host removed; they can't rejoin this meeting session.
    removed_clients: set[str] = field(default_factory=set)
    live: bool = False
    ended: bool = False
    empty_timer: asyncio.Task | None = None

    def cancel_empty_timer(self) -> None:
        if self.empty_timer:
            self.empty_timer.cancel()
            self.empty_timer = None

    def moderators(self) -> list[Peer]:
        return [p for p in self.peers.values() if p.is_moderator]


class RoomManager:
    def __init__(self) -> None:
        self.rooms: dict[str, Room] = {}
        self.db: Db | None = None
        self.empty_grace = get_settings().empty_room_grace_seconds

    def configure(self, session_factory: Callable[[], Session]) -> None:
        self.db = Db(session_factory)

    def room(self, code: str, meeting_id: int, waiting_room: bool = False) -> Room:
        room = self.rooms.get(code)
        if room is None or room.ended:
            room = self.rooms[code] = Room(
                code=code, meeting_id=meeting_id, settings=default_room_settings(waiting_room)
            )
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

    async def kick(self, room: Room, peer: Peer, message: dict[str, Any]) -> None:
        """Send a final message, close the socket and clean up right away.

        Cleanup doesn't wait for the client to acknowledge the close (a stalled
        client would otherwise linger in the room); leave() is idempotent, so the
        socket handler's own cleanup afterwards is harmless.
        """
        await self.send(peer, message)
        try:
            await peer.ws.close()
        except Exception:
            log.debug("close of %s failed", peer.id)
        await self.leave(room, peer)

    # ---- membership ------------------------------------------------------- #

    async def join(self, room: Room, peer: Peer, db_status: MeetingStatus) -> None:
        if peer.client_id and peer.client_id in room.removed_clients:
            return await self.kick(
                room,
                peer,
                {"type": "removed", "message": "You have been removed from this meeting"},
            )
        if peer.role is HOST:
            if not room.live:
                await self.db.run(live.mark_live, room.meeting_id)
                room.live = True
            await self._admit(room, peer)
            # The host's arrival lets everyone who was waiting for them in
            # (through the waiting room, if it's on).
            waiting = list(room.waiting_for_host.values())
            room.waiting_for_host.clear()
            for p in waiting:
                await self._enter(room, p)
        elif room.live or db_status is MeetingStatus.LIVE:
            room.live = True
            await self._enter(room, peer)
        else:
            room.waiting_for_host[peer.id] = peer
            await self.send(peer, {"type": "waiting_for_host"})

    async def _enter(self, room: Room, peer: Peer) -> None:
        """A non-host arriving at a live meeting: lock and waiting room apply."""
        if room.settings["locked"]:
            return await self.kick(
                room,
                peer,
                {
                    "type": "error",
                    "code": "meeting_locked",
                    "message": "This meeting has been locked by the host",
                },
            )
        if room.settings["waiting_room"]:
            room.waiting_room[peer.id] = peer
            await self.send(peer, {"type": "waiting_room"})
            await self._send_waiting_list(room)
        else:
            await self._admit(room, peer)

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
        if peer.is_moderator and room.waiting_room:
            await self._send_waiting_list(room, to=[peer])

    async def _send_waiting_list(self, room: Room, to: list[Peer] | None = None) -> None:
        message = {
            "type": "waiting_list",
            "peers": [{"id": p.id, "name": p.name} for p in room.waiting_room.values()],
        }
        await asyncio.gather(*(self.send(p, message) for p in (to or room.moderators())))

    async def leave(self, room: Room, peer: Peer) -> None:
        room.waiting_for_host.pop(peer.id, None)
        if room.waiting_room.pop(peer.id, None) is not None and not room.ended:
            await self._send_waiting_list(room)
        if room.peers.pop(peer.id, None) is not None:
            await self.db.run(live.close_participant, peer.participant_id, peer.removed)
            if not room.ended:
                await self.broadcast(room, {"type": "peer_left", "peer_id": peer.id})
                if peer.role is HOST and room.peers:
                    await self._reassign_host(room)
        if room.ended or room.peers:
            return
        if room.live:
            room.cancel_empty_timer()
            room.empty_timer = asyncio.create_task(self._end_when_empty(room))
        elif not room.waiting_for_host:
            self.rooms.pop(room.code, None)

    async def _reassign_host(self, room: Room) -> None:
        """The host left without ending: a co-host, else the longest-present person, takes over."""
        if any(p.role is HOST for p in room.peers.values()):
            return
        successor = next((p for p in room.peers.values() if p.role is CO_HOST), None)
        successor = successor or next(iter(room.peers.values()))
        await self._set_role(room, successor, HOST)

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
        everyone = [
            *room.peers.values(),
            *room.waiting_for_host.values(),
            *room.waiting_room.values(),
        ]
        await asyncio.gather(
            *(self.kick(room, p, {"type": "meeting_ended", "reason": reason}) for p in everyone)
        )

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
        if patch.get("mic_muted") is False and peer.state.mic_muted:
            if (
                peer.role is ATTENDEE
                and not room.settings["allow_unmute"]
                and not peer.unmute_invited
            ):
                patch.pop("mic_muted")
                await self.send(peer, {"type": "force_mute", "by": None})
                await self.error(peer, "unmute_disabled", "The host has disabled unmuting")
            else:
                peer.unmute_invited = False
        if not patch:
            return
        peer.state = peer.state.model_copy(update=patch)
        await self.broadcast(
            room, {"type": "peer_updated", "peer_id": peer.id, "patch": patch}, exclude=peer
        )

    def _share_refusal(self, room: Room, peer: Peer) -> tuple[str, str] | None:
        """Why this peer may not start sharing, or None if they may."""
        if peer.role is ATTENDEE and not room.settings["allow_share"]:
            return "share_disabled", "The host has disabled screen sharing"
        sharer = next((p for p in room.peers.values() if p.state.sharing and p is not peer), None)
        if sharer:
            return "share_in_use", f"{sharer.name} is already sharing their screen"
        return None

    async def on_chat(self, room: Room, peer: Peer, msg: ChatMsg) -> None:
        if peer.role is ATTENDEE and not room.settings["allow_chat"]:
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
        if peer.role is ATTENDEE and not room.settings["allow_rename"]:
            return await self.error(peer, "rename_disabled", "The host has disabled renaming")
        peer.name = msg.name
        await self.db.run(live.update_participant, peer.participant_id, name=msg.name)
        await self.broadcast(
            room, {"type": "peer_updated", "peer_id": peer.id, "patch": {"name": msg.name}}
        )

    # ---- host / co-host controls ------------------------------------------ #

    async def _require_moderator(self, peer: Peer) -> bool:
        if not peer.is_moderator:
            await self.error(peer, "not_allowed", "Only the host or a co-host can do this")
        return peer.is_moderator

    async def _target(self, room: Room, peer: Peer, peer_id: str) -> Peer | None:
        """The participant a host action is aimed at; a co-host can't act on the host."""
        target = room.peers.get(peer_id)
        if target is None:
            await self.error(peer, "not_found", "That participant has left the meeting")
        elif target.role is HOST and peer.role is not HOST:
            await self.error(peer, "not_allowed", "A co-host can't do this to the host")
            return None
        return target

    async def _force_mute(self, room: Room, target: Peer, by: Peer) -> None:
        target.unmute_invited = False
        if target.state.mic_muted:
            return
        target.state = target.state.model_copy(update={"mic_muted": True})
        await self.send(target, {"type": "force_mute", "by": by.name})
        await self.broadcast(
            room,
            {"type": "peer_updated", "peer_id": target.id, "patch": {"mic_muted": True}},
            exclude=target,
        )

    async def on_mute(self, room: Room, peer: Peer, msg: MuteMsg) -> None:
        if await self._require_moderator(peer) and (
            target := await self._target(room, peer, msg.peer_id)
        ):
            await self._force_mute(room, target, peer)

    async def on_mute_all(self, room: Room, peer: Peer, msg: MuteAllMsg) -> None:
        if not await self._require_moderator(peer):
            return
        for target in list(room.peers.values()):
            if not target.is_moderator:
                await self._force_mute(room, target, peer)
        if msg.allow_unmute is not None:
            await self._apply_settings(room, {"allow_unmute": msg.allow_unmute})

    async def on_ask_unmute(self, room: Room, peer: Peer, msg: AskUnmuteMsg) -> None:
        if not await self._require_moderator(peer):
            return
        if msg.peer_id:
            target = await self._target(room, peer, msg.peer_id)
            targets = [target] if target else []
        else:
            targets = [p for p in room.peers.values() if p is not peer and p.state.mic_muted]
        for target in targets:
            target.unmute_invited = True
            await self.send(target, {"type": "unmute_request", "by": peer.name})

    async def on_remove(self, room: Room, peer: Peer, msg: RemoveMsg) -> None:
        if not await self._require_moderator(peer):
            return
        target = await self._target(room, peer, msg.peer_id)
        if target is None or target is peer:
            return
        target.removed = True
        if target.client_id:
            room.removed_clients.add(target.client_id)
        await self.kick(
            room,
            target,
            {"type": "removed", "message": "You have been removed from this meeting by the host"},
        )

    async def on_set_role(self, room: Room, peer: Peer, msg: SetRoleMsg) -> None:
        if peer.role is not HOST:
            return await self.error(peer, "not_allowed", "Only the host can change roles")
        target = room.peers.get(msg.peer_id)
        if target is None or target is peer:
            return
        new_role = ParticipantRole(msg.role)
        if new_role is HOST:
            # Handing over: the old host becomes a regular participant, like Zoom.
            await self._set_role(room, peer, ATTENDEE)
        await self._set_role(room, target, new_role)

    async def _set_role(self, room: Room, target: Peer, role: ParticipantRole) -> None:
        target.role = role
        await self.db.run(live.update_participant, target.participant_id, role=role)
        await self.broadcast(
            room, {"type": "peer_updated", "peer_id": target.id, "patch": {"role": role.value}}
        )
        if target.is_moderator and room.waiting_room:
            await self._send_waiting_list(room, to=[target])

    async def on_settings(self, room: Room, peer: Peer, msg: SettingsMsg) -> None:
        if await self._require_moderator(peer):
            await self._apply_settings(room, msg.patch.model_dump(exclude_none=True))

    async def _apply_settings(self, room: Room, patch: dict[str, bool]) -> None:
        room.settings.update(patch)
        await self.broadcast(room, {"type": "settings_updated", "settings": room.settings})
        # Turning the waiting room off lets everyone in it straight in.
        if patch.get("waiting_room") is False and room.waiting_room:
            await self._admit_waiting(room, list(room.waiting_room))

    async def on_admit(self, room: Room, peer: Peer, msg: AdmitMsg) -> None:
        if await self._require_moderator(peer):
            await self._admit_waiting(
                room, [msg.peer_id] if msg.peer_id else list(room.waiting_room)
            )

    async def _admit_waiting(self, room: Room, peer_ids: list[str]) -> None:
        for peer_id in peer_ids:
            if waiting := room.waiting_room.pop(peer_id, None):
                await self._admit(room, waiting)
        await self._send_waiting_list(room)

    async def on_deny(self, room: Room, peer: Peer, msg: DenyMsg) -> None:
        if not await self._require_moderator(peer):
            return
        if waiting := room.waiting_room.get(msg.peer_id):
            await self.kick(
                room,
                waiting,
                {"type": "removed", "message": "The host has removed you from the waiting room"},
            )


manager = RoomManager()

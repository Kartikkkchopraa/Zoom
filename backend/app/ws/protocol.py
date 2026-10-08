"""Messages a client may send on the meeting WebSocket (validated with Pydantic).

Server -> client messages are plain dicts built in app/ws/room.py; their
`type`s are: welcome, waiting_for_host, peer_joined, peer_left, peer_updated,
signal, chat, reaction, meeting_ended, error.
"""

from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, TypeAdapter


class PeerState(BaseModel):
    audio_connected: bool = False
    mic_muted: bool = True
    video_on: bool = False
    sharing: bool = False
    hand_raised: bool = False


class PeerStatePatch(BaseModel):
    audio_connected: bool | None = None
    mic_muted: bool | None = None
    video_on: bool | None = None
    sharing: bool | None = None
    hand_raised: bool | None = None


Name = Annotated[str, Field(min_length=1, max_length=100)]


class JoinMsg(BaseModel):
    type: Literal["join"]
    token: str
    name: Name
    # Ask for the host role; granted only if the token says this user may host.
    as_host: bool = False
    state: PeerState = Field(default_factory=PeerState)


class SignalMsg(BaseModel):
    """WebRTC offer/answer/ICE candidate, relayed verbatim to one peer."""

    type: Literal["signal"]
    to: str
    data: dict[str, Any]


class StateMsg(BaseModel):
    type: Literal["state"]
    patch: PeerStatePatch


class ChatMsg(BaseModel):
    type: Literal["chat"]
    body: Annotated[str, Field(min_length=1, max_length=4000)]
    to: str | None = None  # None = everyone


class ReactionMsg(BaseModel):
    type: Literal["reaction"]
    emoji: Annotated[str, Field(min_length=1, max_length=16)]


class RenameMsg(BaseModel):
    type: Literal["rename"]
    name: Name


class LeaveMsg(BaseModel):
    type: Literal["leave"]


ClientMessage = Annotated[
    JoinMsg | SignalMsg | StateMsg | ChatMsg | ReactionMsg | RenameMsg | LeaveMsg,
    Field(discriminator="type"),
]
client_message = TypeAdapter(ClientMessage)

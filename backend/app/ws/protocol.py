"""Messages a client may send on the meeting WebSocket (validated with Pydantic).

Server -> client messages are plain dicts built in app/ws/room.py; their
`type`s are: welcome, waiting_for_host, waiting_room, waiting_list,
peer_joined, peer_left, peer_updated, settings_updated, signal, chat,
reaction, force_mute, unmute_request, removed, replaced, meeting_ended, error.
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
    # Random id stored in the browser; lets the host's "Remove" stick on rejoin
    # and spots the same browser joining twice.
    client_id: Annotated[str, Field(max_length=64)] | None = None
    # Random id per browser tab (survives a refresh), to tell a duplicate tab
    # from the same tab reconnecting.
    tab_id: Annotated[str, Field(max_length=64)] | None = None
    # "Join here instead": replace this browser's connection in another tab.
    take_over: bool = False


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


# ---- host / co-host controls ------------------------------------------------ #


class MuteMsg(BaseModel):
    type: Literal["mute"]
    peer_id: str


class MuteAllMsg(BaseModel):
    type: Literal["mute_all"]
    # Zoom's "Allow participants to unmute themselves" checkbox in the Mute All dialog.
    allow_unmute: bool | None = None


class AskUnmuteMsg(BaseModel):
    type: Literal["ask_unmute"]
    peer_id: str | None = None  # None = everyone who is muted


class RemoveMsg(BaseModel):
    type: Literal["remove"]
    peer_id: str


class SetRoleMsg(BaseModel):
    """Make co-host / withdraw co-host, or hand the host role over (host only)."""

    type: Literal["set_role"]
    peer_id: str
    role: Literal["host", "co_host", "attendee"]


class RoomSettingsPatch(BaseModel):
    locked: bool | None = None
    waiting_room: bool | None = None
    allow_share: bool | None = None
    allow_chat: bool | None = None
    allow_rename: bool | None = None
    allow_unmute: bool | None = None


class SettingsMsg(BaseModel):
    type: Literal["settings"]
    patch: RoomSettingsPatch


class AdmitMsg(BaseModel):
    type: Literal["admit"]
    peer_id: str | None = None  # None = admit everyone waiting


class DenyMsg(BaseModel):
    type: Literal["deny"]
    peer_id: str


class EndMsg(BaseModel):
    """End Meeting for All (host only)."""

    type: Literal["end"]


ClientMessage = Annotated[
    JoinMsg
    | SignalMsg
    | StateMsg
    | ChatMsg
    | ReactionMsg
    | RenameMsg
    | LeaveMsg
    | MuteMsg
    | MuteAllMsg
    | AskUnmuteMsg
    | RemoveMsg
    | SetRoleMsg
    | SettingsMsg
    | AdmitMsg
    | DenyMsg
    | EndMsg,
    Field(discriminator="type"),
]
client_message = TypeAdapter(ClientMessage)

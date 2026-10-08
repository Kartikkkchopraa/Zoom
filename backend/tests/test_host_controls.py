"""Host and co-host controls over the meeting WebSocket."""

from contextlib import ExitStack

import pytest


def _join(client, stack: ExitStack, code: str, name: str, as_host=False, client_id=None):
    token = client.post("/api/meetings/join-check", json={"meeting": code}).json()["join_token"]
    ws = stack.enter_context(client.websocket_connect(f"/ws/meetings/{code}"))
    ws.send_json(
        {"type": "join", "token": token, "name": name, "as_host": as_host, "client_id": client_id}
    )
    return ws, ws.receive_json()


@pytest.fixture
def code(client) -> str:
    return client.post("/api/meetings/instant").json()["meeting_code"]


def _host_and_guest(client, stack, code, guest_client_id=None):
    host, _ = _join(client, stack, code, "Host", as_host=True)
    guest, welcome = _join(client, stack, code, "Guest", client_id=guest_client_id)
    host.receive_json()  # peer_joined
    return host, guest, welcome["self"]["id"]


def test_host_mutes_attendee_but_attendee_cannot_mute(client, code):
    with ExitStack() as stack:
        host, guest, guest_id = _host_and_guest(client, stack, code)
        guest.send_json({"type": "state", "patch": {"mic_muted": False}})
        host.receive_json()

        host.send_json({"type": "mute", "peer_id": guest_id})
        assert guest.receive_json() == {"type": "force_mute", "by": "Host"}
        assert host.receive_json()["patch"] == {"mic_muted": True}

        guest.send_json({"type": "mute", "peer_id": guest_id})
        assert guest.receive_json()["code"] == "not_allowed"


def test_disabled_unmute_is_enforced_until_host_asks(client, code):
    with ExitStack() as stack:
        host, guest, guest_id = _host_and_guest(client, stack, code)
        guest.send_json({"type": "state", "patch": {"mic_muted": False}})
        host.receive_json()

        host.send_json({"type": "mute_all", "allow_unmute": False})
        assert guest.receive_json()["type"] == "force_mute"
        assert guest.receive_json()["settings"]["allow_unmute"] is False
        assert host.receive_json()["patch"] == {"mic_muted": True}
        assert host.receive_json()["type"] == "settings_updated"

        # Unmuting on their own is refused...
        guest.send_json({"type": "state", "patch": {"mic_muted": False}})
        assert guest.receive_json() == {"type": "force_mute", "by": None}
        assert guest.receive_json()["code"] == "unmute_disabled"

        # ...until the host asks them to unmute.
        host.send_json({"type": "ask_unmute", "peer_id": guest_id})
        assert guest.receive_json() == {"type": "unmute_request", "by": "Host"}
        guest.send_json({"type": "state", "patch": {"mic_muted": False}})
        assert host.receive_json()["patch"] == {"mic_muted": False}


def test_removed_participant_cannot_rejoin(client, code):
    with ExitStack() as stack:
        host, guest, guest_id = _host_and_guest(client, stack, code, guest_client_id="browser-1")
        host.send_json({"type": "remove", "peer_id": guest_id})
        assert guest.receive_json()["type"] == "removed"
        assert host.receive_json() == {"type": "peer_left", "peer_id": guest_id}

        _, again = _join(client, stack, code, "Guest again", client_id="browser-1")
        assert again["type"] == "removed"


def test_waiting_room_admit_and_deny(client, code):
    with ExitStack() as stack:
        host, _ = _join(client, stack, code, "Host", as_host=True)
        host.send_json({"type": "settings", "patch": {"waiting_room": True}})
        assert host.receive_json()["settings"]["waiting_room"] is True

        guest, reply = _join(client, stack, code, "Guest")
        assert reply == {"type": "waiting_room"}
        waiting = host.receive_json()
        assert waiting["type"] == "waiting_list"
        [entry] = waiting["peers"]
        assert entry["name"] == "Guest"

        host.send_json({"type": "admit", "peer_id": entry["id"]})
        assert guest.receive_json()["type"] == "welcome"
        assert host.receive_json()["type"] == "peer_joined"
        assert host.receive_json() == {"type": "waiting_list", "peers": []}

        other, reply = _join(client, stack, code, "Unwanted")
        assert reply == {"type": "waiting_room"}
        unwanted_id = host.receive_json()["peers"][0]["id"]
        host.send_json({"type": "deny", "peer_id": unwanted_id})
        assert other.receive_json()["type"] == "removed"


def test_locked_meeting_rejects_new_joiners(client, code):
    with ExitStack() as stack:
        host, _ = _join(client, stack, code, "Host", as_host=True)
        host.send_json({"type": "settings", "patch": {"locked": True}})
        host.receive_json()
        _, reply = _join(client, stack, code, "Late")
        assert (reply["type"], reply["code"]) == ("error", "meeting_locked")


def test_co_host_can_moderate_but_not_the_host(client, code):
    with ExitStack() as stack:
        host, cohost, cohost_id = _host_and_guest(client, stack, code)
        attendee, welcome = _join(client, stack, code, "Attendee")
        attendee_id = welcome["self"]["id"]
        host_id = next(p["id"] for p in welcome["peers"] if p["name"] == "Host")
        host.receive_json(), cohost.receive_json()  # peer_joined Attendee

        host.send_json({"type": "set_role", "peer_id": cohost_id, "role": "co_host"})
        assert cohost.receive_json()["patch"] == {"role": "co_host"}
        attendee.receive_json()

        attendee.send_json({"type": "state", "patch": {"mic_muted": False}})
        cohost.receive_json()
        cohost.send_json({"type": "mute", "peer_id": attendee_id})
        assert attendee.receive_json()["type"] == "force_mute"
        assert cohost.receive_json()["patch"] == {"mic_muted": True}

        cohost.send_json({"type": "remove", "peer_id": host_id})
        assert cohost.receive_json()["code"] == "not_allowed"


def test_host_leaving_hands_over_the_host_role(client, code):
    with ExitStack() as stack:
        host, guest, guest_id = _host_and_guest(client, stack, code)
        host.send_json({"type": "leave"})
        assert guest.receive_json()["type"] == "peer_left"
        assert guest.receive_json() == {
            "type": "peer_updated",
            "peer_id": guest_id,
            "patch": {"role": "host"},
        }

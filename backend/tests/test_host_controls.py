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


def test_host_ends_meeting_over_the_socket(client, code, db):
    from app.models import Meeting, MeetingStatus

    with ExitStack() as stack:
        host, guest, _ = _host_and_guest(client, stack, code)

        guest.send_json({"type": "end"})
        assert guest.receive_json()["code"] == "not_allowed"

        host.send_json({"type": "end"})
        assert guest.receive_json() == {"type": "meeting_ended", "reason": "ended_by_host"}
        assert host.receive_json() == {"type": "meeting_ended", "reason": "ended_by_host"}

    db.expire_all()
    meeting = db.query(Meeting).filter_by(meeting_code=code).one()
    assert meeting.status is MeetingStatus.ENDED


def test_same_browser_in_another_tab_must_take_over(client, code):
    with ExitStack() as stack:
        token = client.post("/api/meetings/join-check", json={"meeting": code}).json()["join_token"]

        def connect(tab: str, **extra):
            ws = stack.enter_context(client.websocket_connect(f"/ws/meetings/{code}"))
            ws.send_json(
                {
                    "type": "join",
                    "token": token,
                    "name": "Host",
                    "as_host": True,
                    "client_id": "browser-A",
                    "tab_id": tab,
                    **extra,
                }
            )
            return ws, ws.receive_json()

        tab1, first = connect("tab-1")
        assert first["self"]["role"] == "host"
        guest, _ = _join(client, stack, code, "Guest")
        tab1.receive_json()  # peer_joined Guest

        # A second tab of the same browser is refused...
        _, refused = connect("tab-2")
        assert (refused["type"], refused["code"]) == ("error", "already_in_meeting")

        # ...unless it takes over: the first tab is told, the host role moves
        # with it, and nobody else gets promoted in between.
        tab2, welcome = connect("tab-2", take_over=True, as_host=False)
        assert tab1.receive_json()["type"] == "replaced"
        assert welcome["self"]["role"] == "host"
        assert guest.receive_json()["type"] == "peer_left"
        assert guest.receive_json()["type"] == "peer_joined"


def test_same_tab_reconnecting_replaces_silently(client, code):
    with ExitStack() as stack:
        token = client.post("/api/meetings/join-check", json={"meeting": code}).json()["join_token"]
        join = {
            "type": "join",
            "token": token,
            "name": "Host",
            "as_host": True,
            "client_id": "browser-A",
            "tab_id": "tab-1",
        }
        old = stack.enter_context(client.websocket_connect(f"/ws/meetings/{code}"))
        old.send_json(join)
        old.receive_json()

        new = stack.enter_context(client.websocket_connect(f"/ws/meetings/{code}"))
        new.send_json(join)  # e.g. after a page refresh
        assert new.receive_json()["type"] == "welcome"
        assert old.receive_json()["type"] == "replaced"


def test_host_refreshing_keeps_the_role_and_nobody_is_promoted(client, code):
    from app.ws.room import manager

    manager.host_return_grace = 30  # the host is back well within this
    with ExitStack() as stack:
        token = client.post("/api/meetings/join-check", json={"meeting": code}).json()["join_token"]
        join = {
            "type": "join",
            "token": token,
            "name": "Host",
            "as_host": False,
            "client_id": "browser-A",
            "tab_id": "tab-1",
        }

        # Joined via the invite link, then promoted to host by a take-over.
        host = stack.enter_context(client.websocket_connect(f"/ws/meetings/{code}"))
        host.send_json({**join, "as_host": True})
        host.receive_json()
        guest, _ = _join(client, stack, code, "Guest")
        host.receive_json()

        host.close()  # page refresh: the old socket goes away first...
        assert guest.receive_json()["type"] == "peer_left"

        again = stack.enter_context(client.websocket_connect(f"/ws/meetings/{code}"))
        again.send_json(join)  # ...then the page rejoins, as_host False like a link join
        assert again.receive_json()["self"]["role"] == "host"
        # The guest only sees the host come back: no promotion in between.
        msg = guest.receive_json()
        assert msg["type"] == "peer_joined" and msg["peer"]["role"] == "host"


def test_owner_reclaims_host_from_a_temporary_host(client, code):
    with ExitStack() as stack:
        host, guest, guest_id = _host_and_guest(client, stack, code)
        host.send_json({"type": "leave"})
        guest.receive_json()  # peer_left
        assert guest.receive_json()["patch"] == {"role": "host"}  # promoted after the grace

        _join(client, stack, code, "Host again", as_host=True)
        assert guest.receive_json()["type"] == "peer_joined"
        assert guest.receive_json() == {
            "type": "peer_updated",
            "peer_id": guest_id,
            "patch": {"role": "co_host"},
        }

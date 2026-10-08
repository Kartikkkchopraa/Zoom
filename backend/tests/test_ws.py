import time
from datetime import UTC, datetime, timedelta

from app.models import Meeting, MeetingParticipant, MeetingStatus


def _token(client, meeting: str, passcode: str | None = None) -> str:
    res = client.post("/api/meetings/join-check", json={"meeting": meeting, "passcode": passcode})
    assert res.status_code == 200, res.text
    return res.json()["join_token"]


def _join(ws, token: str, name: str, as_host: bool = False):
    ws.send_json({"type": "join", "token": token, "name": name, "as_host": as_host})
    return ws.receive_json()


def _instant(client) -> dict:
    return client.post("/api/meetings/instant").json()


def _wait_for(predicate, timeout=2.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return True
        time.sleep(0.02)
    return False


def test_peers_see_each_other_and_relay_messages(client, db):
    meeting = _instant(client)
    code = meeting["meeting_code"]
    url = f"/ws/meetings/{code}"

    with client.websocket_connect(url) as host:
        welcome = _join(host, _token(client, code), "Aryan", as_host=True)
        assert welcome["type"] == "welcome"
        assert welcome["self"]["role"] == "host"
        assert welcome["peers"] == []
        host_id = welcome["self"]["id"]

        with client.websocket_connect(url) as guest:
            # Same account joining via the invite link (not "Start") is an attendee.
            g = _join(guest, _token(client, meeting["invite_link"]), "Guest")
            assert g["self"]["role"] == "attendee"
            assert [p["id"] for p in g["peers"]] == [host_id]
            guest_id = g["self"]["id"]
            assert host.receive_json() == {"type": "peer_joined", "peer": g["self"]}

            # WebRTC signaling is relayed to exactly the addressed peer.
            guest.send_json({"type": "signal", "to": host_id, "data": {"sdp": "offer"}})
            assert host.receive_json() == {
                "type": "signal",
                "from": guest_id,
                "data": {"sdp": "offer"},
            }

            # Group chat reaches everyone, including the sender.
            guest.send_json({"type": "chat", "body": "hi all"})
            for ws in (guest, host):
                msg = ws.receive_json()["message"]
                assert (msg["body"], msg["recipient_id"]) == ("hi all", None)

            # State changes go to the others.
            guest.send_json({"type": "state", "patch": {"mic_muted": False}})
            assert host.receive_json() == {
                "type": "peer_updated",
                "peer_id": guest_id,
                "patch": {"mic_muted": False},
            }

            guest.send_json({"type": "leave"})
        assert host.receive_json() == {"type": "peer_left", "peer_id": guest_id}

    def attendance_closed():
        db.expire_all()
        rows = db.query(MeetingParticipant).filter_by(meeting_id=meeting["id"]).all()
        assert sorted(r.display_name for r in rows) == ["Aryan", "Guest"]
        return all(r.left_at is not None for r in rows)

    # Cleanup runs after the socket closes, so poll briefly.
    assert _wait_for(attendance_closed)


def test_direct_messages_are_private(client):
    meeting = _instant(client)
    code = meeting["meeting_code"]
    url = f"/ws/meetings/{code}"
    with (
        client.websocket_connect(url) as host,
        client.websocket_connect(url) as a,
        client.websocket_connect(url) as b,
    ):
        _join(host, _token(client, code), "Host", as_host=True)
        a_id = _join(a, _token(client, code), "A")["self"]["id"]
        host.receive_json()  # peer_joined A
        _join(b, _token(client, code), "B")
        host.receive_json()  # peer_joined B
        a.receive_json()  # peer_joined B

        b.send_json({"type": "chat", "body": "psst", "to": a_id})
        assert a.receive_json()["message"]["body"] == "psst"
        assert b.receive_json()["message"]["recipient_id"] == a_id
        # The host must not get it: the next thing the host sees is this reaction.
        a.send_json({"type": "reaction", "emoji": "👍"})
        assert host.receive_json()["type"] == "reaction"


def test_attendees_wait_until_host_starts(client):
    start = (datetime.now(UTC) + timedelta(hours=1)).isoformat()
    meeting = client.post(
        "/api/meetings", json={"title": "Later", "start_time": start, "duration_minutes": 30}
    ).json()
    code = meeting["meeting_code"]
    url = f"/ws/meetings/{code}"

    with client.websocket_connect(url) as guest:
        assert _join(guest, _token(client, meeting["invite_link"]), "Early")["type"] == (
            "waiting_for_host"
        )
        with client.websocket_connect(url) as host:
            host_welcome = _join(host, _token(client, code), "Host", as_host=True)
            assert host_welcome["self"]["role"] == "host"
            # The waiting attendee is admitted as soon as the host arrives.
            guest_welcome = guest.receive_json()
            assert guest_welcome["type"] == "welcome"
            assert [p["name"] for p in guest_welcome["peers"]] == ["Host"]


def test_host_role_requires_owning_the_meeting(client, other):
    room = other.personal_meeting
    with client.websocket_connect(f"/ws/meetings/{room.meeting_code}") as ws:
        token = _token(client, room.meeting_code, room.passcode)
        # Asking for host on someone else's room is ignored; their room isn't live yet.
        assert _join(ws, token, "Impostor", as_host=True)["type"] == "waiting_for_host"


def test_invalid_token_is_rejected(client):
    code = _instant(client)["meeting_code"]
    with client.websocket_connect(f"/ws/meetings/{code}") as ws:
        reply = _join(ws, "not-a-token", "X")
        assert (reply["type"], reply["code"]) == ("error", "invalid_token")


def test_end_for_all_disconnects_everyone(client):
    meeting = _instant(client)
    code = meeting["meeting_code"]
    with client.websocket_connect(f"/ws/meetings/{code}") as host:
        _join(host, _token(client, code), "Host", as_host=True)
        with client.websocket_connect(f"/ws/meetings/{code}") as guest:
            _join(guest, _token(client, code), "Guest")
            host.receive_json()  # peer_joined
            client.post(f"/api/meetings/{meeting['id']}/end")
            assert guest.receive_json() == {"type": "meeting_ended", "reason": "ended_by_host"}


def test_room_ends_after_everyone_leaves(client, db):
    meeting = _instant(client)
    code = meeting["meeting_code"]
    with client.websocket_connect(f"/ws/meetings/{code}") as host:
        _join(host, _token(client, code), "Host", as_host=True)
        host.send_json({"type": "leave"})

    def ended():
        db.expire_all()
        return db.get(Meeting, meeting["id"]).status is MeetingStatus.ENDED

    assert _wait_for(ended)


def test_only_one_person_can_share(client):
    code = _instant(client)["meeting_code"]
    url = f"/ws/meetings/{code}"
    with client.websocket_connect(url) as host, client.websocket_connect(url) as guest:
        _join(host, _token(client, code), "Host", as_host=True)
        _join(guest, _token(client, code), "Guest")
        host.receive_json()  # peer_joined

        host.send_json({"type": "state", "patch": {"sharing": True}})
        assert guest.receive_json()["patch"] == {"sharing": True}

        # A second sharer is refused, but the rest of their update still applies.
        guest.send_json({"type": "state", "patch": {"sharing": True, "video_on": True}})
        error = guest.receive_json()
        assert (error["type"], error["code"]) == ("error", "share_in_use")
        assert host.receive_json()["patch"] == {"video_on": True}

        # Once the first share stops, the next one is allowed.
        host.send_json({"type": "state", "patch": {"sharing": False}})
        guest.receive_json()
        guest.send_json({"type": "state", "patch": {"sharing": True}})
        assert host.receive_json()["patch"] == {"sharing": True}

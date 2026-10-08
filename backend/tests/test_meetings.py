from datetime import UTC, datetime, timedelta

from app.models import Meeting, MeetingParticipant, MeetingStatus


def _future(hours: float = 2) -> str:
    return (datetime.now(UTC) + timedelta(hours=hours)).isoformat()


def _schedule(client, **overrides):
    body = {"title": "Sprint Planning", "start_time": _future(), "duration_minutes": 40}
    body.update(overrides)
    return client.post("/api/meetings", json=body)


# ---- instant meetings ----------------------------------------------------- #


def test_instant_meeting_is_live_with_unique_id_and_link(client):
    a = client.post("/api/meetings/instant").json()
    b = client.post("/api/meetings/instant").json()

    assert a["status"] == "live"
    assert len(a["meeting_code"]) == 11
    assert a["meeting_code"] != b["meeting_code"]
    assert f"/j/{a['meeting_code']}?pwd=" in a["invite_link"]
    assert a["passcode"]


def test_instant_meeting_with_pmi_starts_personal_room(client):
    me = client.get("/api/users/me").json()
    started = client.post("/api/meetings/instant", json={"use_pmi": True}).json()

    assert started["meeting_code"] == me["personal_meeting"]["meeting_code"]
    assert started["status"] == "live"


# ---- scheduling ----------------------------------------------------------- #


def test_schedule_meeting_shows_in_upcoming(client):
    res = _schedule(client, description="Plan scope", invitees=["Priya@Example.com"])
    assert res.status_code == 201
    created = res.json()
    assert created["meeting_type"] == "scheduled"
    assert created["invitees"] == ["priya@example.com"]

    upcoming = client.get("/api/meetings", params={"scope": "upcoming"}).json()
    assert [m["id"] for m in upcoming] == [created["id"]]


def test_schedule_naive_time_is_interpreted_in_given_timezone(client):
    local = (datetime.now(UTC) + timedelta(days=1)).replace(tzinfo=None, microsecond=0)
    created = _schedule(client, start_time=local.isoformat(), timezone="Asia/Kolkata").json()

    expected = local.replace(tzinfo=UTC) - timedelta(hours=5, minutes=30)
    assert datetime.fromisoformat(created["scheduled_start"]) == expected


def test_schedule_rejects_past_time_and_bad_input(client):
    assert _schedule(client, start_time=_future(-3)).json()["error"]["code"] == "start_in_past"
    assert _schedule(client, title="").status_code == 422
    assert _schedule(client, duration_minutes=5).status_code == 422
    assert _schedule(client, timezone="Mars/Olympus").status_code == 422


def test_schedule_with_pmi_borrows_personal_room_code(client):
    me = client.get("/api/users/me").json()
    created = _schedule(client, use_pmi=True).json()
    assert created["meeting_code"] == me["personal_meeting"]["meeting_code"]
    assert created["passcode"] == me["personal_meeting"]["passcode"]


def test_upcoming_hides_meetings_whose_time_has_passed(client, db):
    created = _schedule(client).json()
    meeting = db.get(Meeting, created["id"])
    meeting.scheduled_start = datetime.now(UTC) - timedelta(hours=2)
    db.commit()

    assert client.get("/api/meetings", params={"scope": "upcoming"}).json() == []


# ---- join validation ------------------------------------------------------ #


def test_join_check_validates_existence(client):
    res = client.post("/api/meetings/join-check", json={"meeting": "123 4567 8901"})
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "meeting_not_found"

    res = client.post("/api/meetings/join-check", json={"meeting": "not-an-id"})
    assert res.status_code == 400


def test_join_check_passcode_rules_for_guests(client, db, other):
    room = other.personal_meeting
    code = room.meeting_code

    def check(**body):
        return client.post("/api/meetings/join-check", json=body)

    assert check(meeting=code).json()["error"]["code"] == "passcode_required"
    assert check(meeting=code, passcode="wrong").json()["error"]["code"] == "wrong_passcode"

    ok = check(meeting=code, passcode=room.passcode).json()
    assert ok["is_host"] is False

    # A valid invite link skips the passcode.
    link = f"http://localhost:3000/j/{code}?pwd={room.invite_token}"
    assert check(meeting=link).status_code == 200


def test_host_skips_passcode(client):
    meeting = client.post("/api/meetings/instant").json()
    res = client.post("/api/meetings/join-check", json={"meeting": meeting["meeting_code"]})
    assert res.status_code == 200
    assert res.json()["is_host"] is True


def test_ended_instant_meeting_cannot_be_joined(client):
    meeting = client.post("/api/meetings/instant").json()
    client.post(f"/api/meetings/{meeting['id']}/end")
    res = client.post("/api/meetings/join-check", json={"meeting": meeting["meeting_code"]})
    assert res.status_code == 410


# ---- lifecycle / recent --------------------------------------------------- #


def test_end_meeting_closes_attendance_and_shows_in_previous(client, db):
    meeting = client.post("/api/meetings/instant").json()
    db.add(MeetingParticipant(meeting_id=meeting["id"], display_name="Guest"))
    db.commit()

    ended = client.post(f"/api/meetings/{meeting['id']}/end").json()
    assert ended["status"] == "ended"
    assert db.query(MeetingParticipant).filter_by(left_at=None).count() == 0

    previous = client.get("/api/meetings", params={"scope": "previous"}).json()
    assert previous[0]["id"] == meeting["id"]
    assert previous[0]["participant_count"] == 1


def test_personal_room_returns_to_not_started_after_end(client):
    started = client.post("/api/meetings/instant", json={"use_pmi": True}).json()
    ended = client.post(f"/api/meetings/{started['id']}/end").json()
    assert ended["status"] == MeetingStatus.NOT_STARTED


def test_calendar_returns_meetings_in_window(client):
    created = _schedule(client, start_time=_future(5)).json()
    now = datetime.now(UTC)
    params = {"start": now.isoformat(), "end": (now + timedelta(days=1)).isoformat()}
    assert [m["id"] for m in client.get("/api/meetings/calendar", params=params).json()] == [
        created["id"]
    ]


# ---- edit / delete / permissions ------------------------------------------ #


def test_update_and_delete_scheduled_meeting(client):
    created = _schedule(client).json()
    updated = client.patch(
        f"/api/meetings/{created['id']}", json={"title": "Renamed", "waiting_room": True}
    ).json()
    assert updated["title"] == "Renamed"
    assert updated["waiting_room"] is True

    assert client.delete(f"/api/meetings/{created['id']}").status_code == 204
    assert client.get(f"/api/meetings/{created['id']}").status_code == 404


def test_update_keeps_and_changes_invitees(client):
    created = _schedule(client, invitees=["a@example.com", "b@example.com"]).json()
    url = f"/api/meetings/{created['id']}"

    # Re-sending the same list (what the edit form does) must not fail.
    same = client.patch(url, json={"invitees": ["a@example.com", "b@example.com"]})
    assert same.status_code == 200
    changed = client.patch(url, json={"invitees": ["b@example.com", "c@example.com"]}).json()
    assert changed["invitees"] == ["b@example.com", "c@example.com"]


def test_personal_room_cannot_be_deleted(client):
    pmi_id = client.get("/api/users/me").json()["personal_meeting"]["id"]
    assert client.delete(f"/api/meetings/{pmi_id}").json()["error"]["code"] == "not_deletable"


def test_only_host_can_modify(client, other):
    other_room = other.personal_meeting
    res = client.post(f"/api/meetings/{other_room.id}/start")
    assert res.status_code == 403


def test_invitation_text(client):
    created = _schedule(client).json()
    text = client.get(f"/api/meetings/{created['id']}/invitation").json()["text"]
    assert "Aryan Chopra is inviting you" in text
    assert created["invite_link"] in text
    assert f"Passcode: {created['passcode']}" in text

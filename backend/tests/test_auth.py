from fastapi.testclient import TestClient

from app.core.security import hash_password
from app.main import app
from app.models import Meeting, MeetingType


def test_default_user_is_signed_in_without_a_session(client):
    me = client.get("/api/users/me").json()
    assert me["user"]["email"] == "aryan@zoomclone.dev"


def test_signup_creates_account_with_personal_room_and_session(client, db):
    res = client.post(
        "/api/auth/signup",
        json={"name": "New Person", "email": "New@Example.com", "password": "secret123"},
    )
    assert res.status_code == 201
    assert "zoom_session" in res.cookies
    assert res.json()["user"]["email"] == "new@example.com"

    # The cookie now identifies the new user, not the default one.
    me = client.get("/api/users/me").json()
    assert me["user"]["name"] == "New Person"
    pmi = db.get(Meeting, me["personal_meeting"]["id"])
    assert pmi.meeting_type is MeetingType.PERSONAL


def test_signup_rejects_duplicate_email_and_weak_password(client):
    body = {"name": "A", "email": "aryan@zoomclone.dev", "password": "secret123"}
    assert client.post("/api/auth/signup", json=body).json()["error"]["code"] == "email_taken"
    weak = {**body, "email": "x@example.com", "password": "short"}
    assert client.post("/api/auth/signup", json=weak).status_code == 422


def test_signup_links_existing_invitations(client):
    start = "2099-01-01T10:00:00"
    client.post(
        "/api/meetings",
        json={
            "title": "Future",
            "start_time": start,
            "duration_minutes": 30,
            "invitees": ["invited@example.com"],
        },
    )
    client.post(
        "/api/auth/signup",
        json={"name": "Invited", "email": "invited@example.com", "password": "secret123"},
    )
    upcoming = client.get("/api/meetings", params={"scope": "upcoming"}).json()
    assert [m["title"] for m in upcoming] == ["Future"]


def test_logout_requires_signing_in_again(client, me):
    assert client.post("/api/auth/logout").status_code == 204
    res = client.get("/api/users/me")
    assert (res.status_code, res.json()["error"]["code"]) == (401, "not_authenticated")

    bad = client.post("/api/auth/login", json={"email": me.email, "password": "nope"})
    assert bad.json()["error"]["code"] == "invalid_credentials"


def test_login_sets_session(client, db, me):
    me.password_hash = hash_password("password123")
    db.commit()
    client.post("/api/auth/logout")
    res = client.post(
        "/api/auth/login", json={"email": "ARYAN@zoomclone.dev", "password": "password123"}
    )
    assert res.status_code == 200
    assert client.get("/api/users/me").json()["user"]["id"] == me.id


def test_signed_out_guest_can_join_by_link_but_not_host(client):
    meeting = client.post("/api/meetings/instant").json()
    client.post("/api/auth/logout")

    res = client.post("/api/meetings/join-check", json={"meeting": meeting["invite_link"]})
    assert res.status_code == 200
    assert res.json()["is_host"] is False
    # Account pages still need a session.
    assert client.get("/api/meetings").status_code == 401


def test_a_fresh_browser_gets_the_default_user(client):
    with TestClient(app) as other_browser:
        assert other_browser.get("/api/users/me").status_code == 200


def test_update_profile_and_settings(client):
    me = client.patch("/api/users/me", json={"name": "  Aryan C  "}).json()
    assert me["user"]["name"] == "Aryan C"
    assert me["user"]["initials"] == "AC"

    me = client.patch("/api/users/me/settings", json={"video_off_on_join": True}).json()
    assert me["settings"] == {"mute_mic_on_join": True, "video_off_on_join": True}
    assert client.patch("/api/users/me", json={"name": ""}).status_code == 422


def test_default_user_fallback_becomes_a_real_session(client):
    res = client.get("/api/users/me")
    assert "zoom_session" in res.cookies
    # Once signed in for real, opening an invite link keeps the account.
    client.post("/api/auth/guest")
    assert client.get("/api/users/me").status_code == 200


def test_fresh_browser_opening_an_invite_link_joins_as_guest(client):
    meeting = client.post("/api/meetings/instant").json()  # created as the default user

    client.cookies.clear()  # another device: no cookies at all
    assert client.post("/api/auth/guest").status_code == 204
    assert client.get("/api/users/me").status_code == 401
    res = client.post("/api/meetings/join-check", json={"meeting": meeting["invite_link"]})
    assert res.status_code == 200
    assert res.json()["is_host"] is False

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings
from app.core.db import get_db
from app.main import app
from app.models import Base, User, UserSettings
from app.services.meeting_service import create_personal_room


@pytest.fixture
def db() -> Iterator[Session]:
    # A fresh in-memory database per test; StaticPool keeps a single connection
    # so every session sees the same in-memory data.
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    event.listen(engine, "connect", lambda conn, _: conn.execute("PRAGMA foreign_keys=ON"))
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def make_user(db: Session, name: str, email: str) -> User:
    user = User(name=name, email=email, password_hash="x")
    user.settings = UserSettings()
    db.add(user)
    db.flush()
    create_personal_room(db, user)
    db.commit()
    return user


@pytest.fixture
def me(db: Session) -> User:
    return make_user(db, "Aryan Chopra", get_settings().default_user_email)


@pytest.fixture
def other(db: Session) -> User:
    return make_user(db, "Priya Sharma", "priya@example.com")


@pytest.fixture
def client(db: Session, me: User) -> Iterator[TestClient]:
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

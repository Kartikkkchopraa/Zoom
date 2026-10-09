from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.core.db import get_db
from app.main import app
from app.models import Base, User, UserSettings
from app.services.meeting_service import create_personal_room
from app.ws.room import manager


def _sqlite_pragmas(conn, _record) -> None:
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA journal_mode=WAL")


@pytest.fixture
def engine(tmp_path) -> Iterator[Engine]:
    # A fresh database file per test. A real file (not :memory:) gives each
    # session its own connection, so REST calls and WebSocket handlers running
    # on different threads behave exactly as in production.
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}", connect_args={"check_same_thread": False}
    )
    event.listen(engine, "connect", _sqlite_pragmas)
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture
def db(session_factory: sessionmaker[Session]) -> Iterator[Session]:
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


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
    return make_user(db, "Kartik Chopra", get_settings().default_user_email)


@pytest.fixture
def other(db: Session) -> User:
    return make_user(db, "Priya Sharma", "priya@example.com")


@pytest.fixture
def client(db: Session, me: User, session_factory: sessionmaker[Session]) -> Iterator[TestClient]:
    app.dependency_overrides[get_db] = lambda: db
    app.state.session_factory = session_factory
    manager.rooms.clear()
    manager.empty_grace = 0
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    del app.state.session_factory

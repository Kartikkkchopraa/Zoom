from dataclasses import dataclass
from datetime import timedelta

import bcrypt
import jwt

from app.core.config import get_settings
from app.models.base import utcnow

_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


@dataclass(frozen=True)
class JoinClaims:
    meeting_id: int
    code: str
    user_id: int | None
    can_host: bool


def create_join_token(*, meeting_id: int, code: str, user_id: int | None, can_host: bool) -> str:
    """Signed proof that the bearer passed the join check (ID + passcode) for one room."""
    settings = get_settings()
    payload = {
        "typ": "join",
        "mid": meeting_id,
        "code": code,
        "uid": user_id,
        "host": can_host,
        "exp": utcnow() + timedelta(minutes=settings.join_token_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM)


def decode_join_token(token: str) -> JoinClaims | None:
    try:
        data = jwt.decode(token, get_settings().jwt_secret, algorithms=[_ALGORITHM])
    except jwt.PyJWTError:
        return None
    if data.get("typ") != "join":
        return None
    return JoinClaims(data["mid"], data["code"], data.get("uid"), bool(data.get("host")))

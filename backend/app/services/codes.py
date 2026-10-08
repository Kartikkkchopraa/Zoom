"""Generation and parsing of meeting IDs, passcodes and invite links."""

import re
import secrets
import string
from dataclasses import dataclass
from urllib.parse import parse_qs, urlparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Meeting

MEETING_CODE_LENGTH = 11
PMI_LENGTH = 10
_PASSCODE_ALPHABET = string.ascii_letters + string.digits


def _random_digits(length: int) -> str:
    # First digit is never 0 so IDs keep their length when treated as numbers.
    return str(secrets.randbelow(9) + 1) + "".join(
        str(secrets.randbelow(10)) for _ in range(length - 1)
    )


def generate_meeting_code(db: Session, length: int = MEETING_CODE_LENGTH) -> str:
    while True:
        code = _random_digits(length)
        exists = db.scalar(select(Meeting.id).where(Meeting.meeting_code == code))
        if not exists:
            return code


def generate_passcode(length: int = 6) -> str:
    return "".join(secrets.choice(_PASSCODE_ALPHABET) for _ in range(length))


def generate_invite_token() -> str:
    return secrets.token_urlsafe(24)


def format_meeting_code(code: str) -> str:
    """Group digits like Zoom: 11 digits -> '720 8740 5307', 10 -> '292 081 6742'."""
    if len(code) == 11:
        return f"{code[:3]} {code[3:7]} {code[7:]}"
    if len(code) == 10:
        return f"{code[:3]} {code[3:6]} {code[6:]}"
    return code


@dataclass(frozen=True)
class ParsedJoinInput:
    meeting_code: str
    invite_token: str | None = None


_LINK_CODE = re.compile(r"/(?:j|wc)/(\d{9,11})")


def parse_join_input(raw: str) -> ParsedJoinInput | None:
    """Accept either a meeting ID ('720 8740 5307') or an invite link.

    Returns None when the input is neither.
    """
    value = raw.strip()
    if "/" in value:
        parsed = urlparse(value if "://" in value else f"https://{value}")
        match = _LINK_CODE.search(parsed.path)
        if not match:
            return None
        token = parse_qs(parsed.query).get("pwd", [None])[0]
        return ParsedJoinInput(match.group(1), token)

    digits = re.sub(r"[\s-]", "", value)
    if re.fullmatch(r"\d{9,11}", digits):
        return ParsedJoinInput(digits)
    return None

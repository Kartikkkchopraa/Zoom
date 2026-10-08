import pytest

from app.services.codes import format_meeting_code, parse_join_input


@pytest.mark.parametrize(
    ("raw", "code", "token"),
    [
        ("72087405307", "72087405307", None),
        ("720 8740 5307", "72087405307", None),
        ("720-8740-5307", "72087405307", None),
        ("http://localhost:3000/j/72087405307?pwd=abc_123", "72087405307", "abc_123"),
        ("localhost:3000/j/2920816742", "2920816742", None),
        ("https://zoom.example/wc/72087405307", "72087405307", None),
        ("/j/72087405307?pwd=ab-c_1", "72087405307", "ab-c_1"),
    ],
)
def test_parse_join_input_accepts_ids_and_links(raw, code, token):
    parsed = parse_join_input(raw)
    assert parsed is not None
    assert parsed.meeting_code == code
    assert parsed.invite_token == token


@pytest.mark.parametrize("raw", ["", "abc", "1234", "https://example.com/other/123"])
def test_parse_join_input_rejects_garbage(raw):
    assert parse_join_input(raw) is None


def test_format_meeting_code():
    assert format_meeting_code("72087405307") == "720 8740 5307"
    assert format_meeting_code("2920816742") == "292 081 6742"

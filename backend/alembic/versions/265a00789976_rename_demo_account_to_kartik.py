"""rename demo account to kartik

Data migration: the seeded demo account changes from Aryan Chopra
(aryan@zoomclone.dev) to Kartik Chopra (kartikchopra@demo.dev). Databases
that already hold the old account (e.g. production) are updated in place so
its meetings and history are kept; fresh databases get the new account from
the seed and this is a no-op.

Revision ID: 265a00789976
Revises: cb62ff90211e
Create Date: 2026-10-09 09:10:36.548383

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '265a00789976'
down_revision: Union[str, Sequence[str], None] = 'cb62ff90211e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD = {"email": "aryan@zoomclone.dev", "name": "Aryan Chopra"}
NEW = {"email": "kartikchopra@demo.dev", "name": "Kartik Chopra"}


def _rename(src: dict, dst: dict) -> None:
    conn = op.get_bind()
    user_id = conn.execute(
        sa.text("SELECT id FROM users WHERE email = :email"), {"email": src["email"]}
    ).scalar()
    taken = conn.execute(
        sa.text("SELECT 1 FROM users WHERE email = :email"), {"email": dst["email"]}
    ).scalar()
    if user_id is None or taken:
        return
    conn.execute(
        sa.text("UPDATE users SET email = :email, name = :name WHERE id = :id"),
        {**dst, "id": user_id},
    )
    # Titles that embed the owner's name ("X's Personal Meeting Room", "X's Zoom Meeting").
    conn.execute(
        sa.text(
            "UPDATE meetings SET title = REPLACE(title, :old, :new) "
            "WHERE host_id = :id AND title LIKE :pattern"
        ),
        {"old": f"{src['name']}'s", "new": f"{dst['name']}'s", "id": user_id, "pattern": f"{src['name']}'s %"},
    )
    conn.execute(
        sa.text("UPDATE meeting_participants SET display_name = :new WHERE user_id = :id AND display_name = :old"),
        {"old": src["name"], "new": dst["name"], "id": user_id},
    )


def upgrade() -> None:
    _rename(OLD, NEW)


def downgrade() -> None:
    _rename(NEW, OLD)

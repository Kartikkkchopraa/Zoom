#!/bin/sh
# Container entrypoint: migrate, seed an empty database, then serve.
set -e

# SQLite lives on the mounted volume (e.g. DATABASE_URL=sqlite:////data/zoom.db).
mkdir -p /data

alembic upgrade head
python -m app.seed   # no-op when the database already has data

# --proxy-headers: Railway terminates HTTPS in front of us.
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips="*"

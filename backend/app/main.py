import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.errors import register_error_handlers
from app.routers import meetings, rtc, users
from app.services.live_service import end_stale_live_meetings
from app.ws import router as ws_router
from app.ws.room import manager

settings = get_settings()
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Tests swap in their own database by setting app.state.session_factory.
    session_factory = getattr(app.state, "session_factory", SessionLocal)
    manager.configure(session_factory)
    # Rooms live in memory, so meetings still marked live came from a previous run.
    with session_factory() as db:
        if stale := end_stale_live_meetings(db):
            log.info("Ended %d stale live meetings", stale)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_error_handlers(app)

app.include_router(users.router)
app.include_router(meetings.router)
app.include_router(rtc.router)
app.include_router(ws_router.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

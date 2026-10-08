from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter(prefix="/api/rtc", tags=["rtc"])


@router.get("/config")
def rtc_config() -> dict:
    """ICE servers for RTCPeerConnection. TURN credentials stay server-side config."""
    settings = get_settings()
    servers: list[dict] = [{"urls": settings.stun_urls}]
    if settings.turn_urls:
        servers.append(
            {
                "urls": settings.turn_urls,
                "username": settings.turn_username,
                "credential": settings.turn_credential,
            }
        )
    return {"ice_servers": servers}

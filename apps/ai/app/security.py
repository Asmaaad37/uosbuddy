"""Request signing between Next.js and this service.

Next.js sends `X-UOSB-Timestamp` (unix seconds) and `X-UOSB-Signature`, the hex
HMAC-SHA256 of `f"{timestamp}.{raw_body}"` keyed with AI_SERVICE_HMAC_SECRET.
Requests older than five minutes are rejected to limit replays.
"""

import hashlib
import hmac
import time
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status

from app.config import Settings, get_settings

MAX_SKEW_SECONDS = 300


def sign(secret: str, timestamp: str, body: bytes) -> str:
    return hmac.new(secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()


async def require_signature(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    x_uosb_timestamp: Annotated[str | None, Header()] = None,
    x_uosb_signature: Annotated[str | None, Header()] = None,
) -> None:
    secret = settings.ai_service_hmac_secret
    if not secret:
        # Fail closed: internal endpoints are unusable until the secret is configured.
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "AI service is not configured")
    if not x_uosb_timestamp or not x_uosb_signature or not x_uosb_timestamp.isdigit():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing signature")
    if abs(time.time() - int(x_uosb_timestamp)) > MAX_SKEW_SECONDS:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Stale signature")
    expected = sign(secret, x_uosb_timestamp, await request.body())
    if not hmac.compare_digest(expected, x_uosb_signature):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Bad signature")

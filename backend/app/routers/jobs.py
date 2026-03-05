from __future__ import annotations

import asyncio
import logging
import time

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["jobs"])

_KEEPALIVE_INTERVAL = 15  # seconds
_POLL_SLEEP = 0.05  # seconds between loop iterations


@router.get("/job/{job_id}")
async def stream_job_progress(job_id: str, request: Request) -> StreamingResponse:
    redis = request.app.state.redis

    async def event_generator():
        pubsub = redis.pubsub()
        await pubsub.subscribe(f"job:{job_id}:progress")
        last_keepalive = time.monotonic()

        try:
            while True:
                if await request.is_disconnected():
                    logger.info("Client disconnected from job %s stream", job_id)
                    break

                # Check for terminal status before draining pubsub
                status = await redis.get(f"job:{job_id}:status")
                if status in ("done", "failed"):
                    yield f"event: status\ndata: {status}\n\n"
                    break

                # Drain one pending pubsub message if available
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=0.1
                )
                if message is not None:
                    data = message["data"]
                    if isinstance(data, bytes):
                        data = data.decode()
                    yield f"data: {data}\n\n"

                # Emit keepalive comment every _KEEPALIVE_INTERVAL seconds
                now = time.monotonic()
                if now - last_keepalive >= _KEEPALIVE_INTERVAL:
                    yield ": keepalive\n\n"
                    last_keepalive = now

                await asyncio.sleep(_POLL_SLEEP)
        finally:
            await pubsub.unsubscribe(f"job:{job_id}:progress")
            await pubsub.aclose()
            logger.debug("Closed pubsub for job %s", job_id)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

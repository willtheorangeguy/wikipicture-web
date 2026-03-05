from __future__ import annotations

import logging
import uuid

import magic
from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from app.config import settings
from app.models import JobResponse, JobStatus
from app.rate_limit import RateLimiter
from app.storage import create_job_dir, save_upload
from app.tasks.process import process_photos

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["upload"])

ALLOWED_MIME_TYPES = {"image/jpeg", "image/heic", "image/heif"}


@router.post("/upload", response_model=JobResponse)
async def upload_photos(
    request: Request,
    photos: list[UploadFile] = File(...),
) -> JobResponse:
    # 1. Resolve client IP (support reverse-proxy X-Forwarded-For)
    forwarded_for = request.headers.get("X-Forwarded-For")
    ip = forwarded_for.split(",")[0].strip() if forwarded_for else request.client.host

    # 2. Rate-limit check
    rate_limiter = RateLimiter(request.app.state.redis)
    await rate_limiter.check_upload_rate(ip)

    # 3. Photo count validation
    if len(photos) > settings.max_photos_per_upload:
        raise HTTPException(
            status_code=422,
            detail=f"Too many photos: maximum is {settings.max_photos_per_upload}, got {len(photos)}",
        )

    # 4. Read every file, detect MIME type from first 512 bytes, accumulate total size
    file_contents: list[tuple[str, bytes]] = []
    total_bytes = 0

    for photo in photos:
        header = await photo.read(512)
        detected_mime = magic.from_buffer(header, mime=True)
        if detected_mime not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Unsupported file type '{detected_mime}' for '{photo.filename}'. "
                    "Only JPEG and HEIC/HEIF are allowed."
                ),
            )
        rest = await photo.read()
        content = header + rest
        total_bytes += len(content)
        safe_name = photo.filename or f"photo_{len(file_contents)}.jpg"
        file_contents.append((safe_name, content))

    # 5. Total-size guard
    if total_bytes > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Upload too large: {total_bytes} bytes exceeds {settings.max_upload_bytes} byte limit",
        )

    # 6. Persist files
    job_id = str(uuid.uuid4())
    create_job_dir(job_id)

    saved_paths = []
    for filename, content in file_contents:
        path = save_upload(job_id, filename, content)
        saved_paths.append(path)

    # 7. Register active job and dispatch Celery task
    rate_limiter.set_active_job(ip, job_id)
    await rate_limiter.add_photos(ip, len(photos))
    process_photos.delay(job_id, [str(p) for p in saved_paths])

    logger.info("Job %s queued: %d photos from %s", job_id, len(photos), ip)
    return JobResponse(
        job_id=job_id,
        status=JobStatus.QUEUED,
        message=f"Processing {len(photos)} photos",
    )

from __future__ import annotations

import logging
from pathlib import PurePosixPath

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

from app.models import OpportunityOut, ResultsResponse
from app.rate_limit import RateLimiter
from app.storage import cleanup_job, get_report_path, load_results

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["results"])


def _map_opportunity(opp: dict) -> OpportunityOut:
    """Map a serialised PhotoOpportunity dict to the API response model."""
    # filepath → filename
    fp = opp.get("filepath") or opp.get("filename", "unknown")
    filename = PurePosixPath(fp).name

    # best_article: keep only the fields OpportunityOut expects
    ba = opp.get("best_article")
    best_article = None
    if ba and isinstance(ba, dict):
        best_article = {
            "title": ba.get("title", ""),
            "url": ba.get("url", ""),
            "image_count": ba.get("image_count", 0),
            "needs_photo": ba.get("needs_photo", False),
        }

    # commons_result → commons
    cr = opp.get("commons_result") or opp.get("commons")
    commons = None
    if cr and isinstance(cr, dict):
        sat = cr.get("saturation", "unknown")
        if isinstance(sat, dict):
            sat = sat.get("value", str(sat))
        commons = {
            "nearby_image_count": cr.get("nearby_image_count", 0),
            "saturation": str(sat),
        }

    # quality: keep only the fields OpportunityOut expects
    q = opp.get("quality")
    quality = None
    if q and isinstance(q, dict):
        quality = {
            "megapixels": q.get("megapixels", 0.0),
            "overall_suitable": q.get("overall_suitable", False),
        }

    return OpportunityOut(
        filename=filename,
        latitude=opp.get("latitude", 0.0),
        longitude=opp.get("longitude", 0.0),
        location_name=opp.get("location_name", "Unknown"),
        score=opp.get("score", 0.0),
        recommendation=opp.get("recommendation", ""),
        reasons=opp.get("reasons", []),
        best_article=best_article,
        commons=commons,
        quality=quality,
        thumbnail_b64=opp.get("thumbnail_b64"),
    )


@router.get("/results/{job_id}", response_model=ResultsResponse)
async def get_results(job_id: str, request: Request) -> ResultsResponse:
    results = load_results(job_id)

    if results is None:
        # Distinguish "still running" from "never existed / expired"
        redis = request.app.state.redis
        status = await redis.get(f"job:{job_id}:status")
        if status in ("processing", "queued"):
            raise HTTPException(status_code=202, detail="Job is still processing")
        raise HTTPException(status_code=404, detail=f"Results for job '{job_id}' not found")

    return ResultsResponse(
        job_id=results["job_id"],
        total_photos=results["total_photos"],
        opportunities=[_map_opportunity(opp) for opp in results.get("opportunities", [])],
    )


@router.get("/download/{job_id}")
async def download_report(job_id: str) -> FileResponse:
    path = get_report_path(job_id)
    if path is None:
        raise HTTPException(status_code=404, detail=f"Report for job '{job_id}' not found")

    logger.info("Serving report for job %s", job_id)
    return FileResponse(
        path=path,
        media_type="text/html",
        filename="wikipicture_report.html",
    )


@router.delete("/job/{job_id}")
async def delete_job(job_id: str, request: Request) -> dict:
    forwarded_for = request.headers.get("X-Forwarded-For")
    ip = forwarded_for.split(",")[0].strip() if forwarded_for else request.client.host

    cleanup_job(job_id)

    rate_limiter = RateLimiter(request.app.state.redis)
    rate_limiter.clear_active_job(ip)

    logger.info("Job %s deleted by %s", job_id, ip)
    return {"deleted": True}

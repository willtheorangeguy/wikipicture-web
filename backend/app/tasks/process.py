"""Celery task that runs the full WikiPicture pipeline on uploaded photos."""

from __future__ import annotations

import base64
import dataclasses
import datetime
import io
import json
import logging
from enum import Enum
from pathlib import Path

import redis as redis_lib
from celery import Celery

from app.config import settings
from app.models import ProgressEvent
from app.storage import save_results

logger = logging.getLogger(__name__)

celery_app = Celery("wikipicture", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.update(
    task_serializer="json",
    result_expires=settings.job_ttl_seconds,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)


def publish_progress(
    redis_client: redis_lib.Redis,
    job_id: str,
    step: str,
    current: int,
    total: int,
    message: str,
) -> None:
    event = ProgressEvent(
        job_id=job_id,
        step=step,
        current=current,
        total=total,
        message=message,
    )
    payload = json.dumps(dataclasses.asdict(event))
    redis_client.publish(f"job:{job_id}:progress", payload)


def generate_thumbnail(filepath: Path, max_size: int = 200) -> str | None:
    try:
        import pillow_heif
        from PIL import Image

        pillow_heif.register_heif_opener()

        with Image.open(filepath) as img:
            img.thumbnail((max_size, max_size))
            buf = io.BytesIO()
            img.convert("RGB").save(buf, format="JPEG")
            return base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception:
        logger.debug("Thumbnail generation failed for %s", filepath, exc_info=True)
        return None


def _make_serializable(obj: object) -> object:
    """Recursively convert an object to a JSON-serializable form."""
    if isinstance(obj, dict):
        return {k: _make_serializable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_make_serializable(v) for v in obj]
    if isinstance(obj, Enum):
        return obj.value
    if isinstance(obj, Path):
        return str(obj)
    if isinstance(obj, datetime.datetime):
        return obj.isoformat()
    if dataclasses.is_dataclass(obj) and not isinstance(obj, type):
        return _make_serializable(dataclasses.asdict(obj))
    return obj


@celery_app.task(bind=True, name="process_photos")
def process_photos(self, job_id: str, file_paths: list[str]) -> dict:  # noqa: C901
    from wikipicture.clustering import cluster_photos
    from wikipicture.commons_checker import check_commons_saturation
    from wikipicture.exif_extractor import extract_metadata
    from wikipicture.geocoder import reverse_geocode
    from wikipicture.quality_filter import assess_quality
    from wikipicture.scorer import rank_opportunities, score_opportunity
    from wikipicture.wiki_analyzer import search_articles

    r = redis_lib.from_url(settings.redis_url)
    total = len(file_paths)

    try:
        # Step 1 — extract EXIF/GPS metadata
        publish_progress(r, job_id, "extracting", 0, total, "Extracting GPS data from photos...")
        photos_with_gps = []
        for i, p in enumerate(file_paths):
            meta = extract_metadata(Path(p))
            if meta is not None and meta.latitude is not None and meta.longitude is not None:
                photos_with_gps.append(meta)
            publish_progress(r, job_id, "extracting", i + 1, total, f"Extracted {i + 1}/{total} photos")

        # Step 2 — cluster by location
        clusters = cluster_photos(photos_with_gps)

        all_opportunities = []
        num_clusters = len(clusters)

        for ci, cluster in enumerate(clusters):
            # representative coords from cluster centroid
            lat = cluster.center_lat
            lon = cluster.center_lon

            # Geocode
            publish_progress(r, job_id, "geocoding", ci, num_clusters, f"Geocoding cluster {ci + 1}/{num_clusters}...")
            location: object = reverse_geocode(lat, lon)
            location_name: str = location.name if hasattr(location, "name") else str(location)

            # Wikipedia
            publish_progress(r, job_id, "wikipedia", ci, num_clusters, f"Searching Wikipedia for {location_name}...")
            articles = search_articles(location_name, lat, lon)

            # Commons saturation
            publish_progress(r, job_id, "commons", ci, num_clusters, f"Checking Commons saturation for cluster {ci + 1}...")
            commons = check_commons_saturation(lat, lon)

            # Quality + scoring per photo
            for photo in cluster.photos:
                filepath = Path(photo.filepath) if hasattr(photo, "filepath") else Path(str(photo))
                quality = assess_quality(filepath)
                opportunity = score_opportunity(articles, commons, quality, filepath, lat, lon, location_name)
                all_opportunities.append(opportunity)

        # Step 3 — rank
        ranked = rank_opportunities(all_opportunities)

        # Step 4 — generate thumbnails for top 20
        for opp in ranked[:20]:
            fp_attr = getattr(opp, "filepath", None)
            if fp_attr is not None:
                thumb = generate_thumbnail(Path(str(fp_attr)))
                if thumb is not None:
                    try:
                        opp.thumbnail_b64 = thumb
                    except Exception:
                        pass  # dataclass may be frozen; ignore

        # Step 5 — serialise
        serialisable = _make_serializable(ranked)
        results_dict = {
            "job_id": job_id,
            "total_photos": total,
            "opportunities": serialisable,
        }

        save_results(job_id, results_dict)

        publish_progress(r, job_id, "done", total, total, "Analysis complete!")
        r.set(f"job:{job_id}:status", "done", ex=settings.job_ttl_seconds)

        return results_dict

    except Exception as e:
        logger.exception("process_photos failed for job %s", job_id)
        r.set(f"job:{job_id}:status", "failed", ex=settings.job_ttl_seconds)
        publish_progress(r, job_id, "failed", 0, total, str(e))
        raise


@celery_app.task(name="cleanup_old_jobs")
def cleanup_old_jobs_task() -> None:
    from app.storage import cleanup_old_jobs

    count = cleanup_old_jobs(max_age_seconds=settings.job_ttl_seconds)
    logger.info("Cleaned up %d old jobs", count)


celery_app.conf.beat_schedule = {
    "cleanup-old-jobs": {
        "task": "cleanup_old_jobs",
        "schedule": 600.0,  # every 10 minutes
    }
}

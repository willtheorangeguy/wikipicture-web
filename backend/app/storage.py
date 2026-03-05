from __future__ import annotations

import json
import shutil
import time
from pathlib import Path

from app.config import settings


def get_job_dir(job_id: str) -> Path:
    return Path(settings.temp_dir) / job_id


def create_job_dir(job_id: str) -> Path:
    job_dir = get_job_dir(job_id)
    job_dir.mkdir(parents=True, exist_ok=True)
    return job_dir


def save_upload(job_id: str, filename: str, data: bytes) -> Path:
    job_dir = create_job_dir(job_id)
    dest = job_dir / filename
    dest.write_bytes(data)
    return dest


def get_results_path(job_id: str) -> Path:
    return get_job_dir(job_id) / "results.json"


def save_results(job_id: str, data: dict) -> None:
    get_results_path(job_id).write_text(json.dumps(data), encoding="utf-8")


def load_results(job_id: str) -> dict | None:
    path = get_results_path(job_id)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def save_report(job_id: str, html: str) -> Path:
    path = get_job_dir(job_id) / "report.html"
    path.write_text(html, encoding="utf-8")
    return path


def get_report_path(job_id: str) -> Path | None:
    path = get_job_dir(job_id) / "report.html"
    return path if path.exists() else None


def cleanup_job(job_id: str) -> None:
    job_dir = get_job_dir(job_id)
    if job_dir.exists():
        shutil.rmtree(job_dir)


def cleanup_old_jobs(max_age_seconds: int = 3600) -> int:
    """Remove job directories older than max_age_seconds. Returns number removed."""
    base = Path(settings.temp_dir)
    if not base.exists():
        return 0
    cutoff = time.time() - max_age_seconds
    removed = 0
    for job_dir in base.iterdir():
        if job_dir.is_dir() and job_dir.stat().st_mtime < cutoff:
            shutil.rmtree(job_dir)
            removed += 1
    return removed

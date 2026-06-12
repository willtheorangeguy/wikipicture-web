"""Tests for HTTP 429 (rate-limit) handling in the photo-processing task.

The wikipicture library swallows upstream HTTP errors internally, so a 429 never
propagates to the Celery task on its own. The task instead detects 429s via a
hook on the requests transport layer (`_tracking_send`) and bails out with a
user-facing message. These tests exercise that path without a real broker,
Redis, or network access.
"""

from __future__ import annotations

import json
import sys
import types
from unittest.mock import MagicMock

import pytest

from app.tasks import process


class FakeRedis:
    """Minimal stand-in recording publishes and key writes."""

    def __init__(self) -> None:
        self.published: list[tuple[str, str]] = []
        self.kv: dict[str, str] = {}

    def publish(self, channel: str, payload: str) -> None:
        self.published.append((channel, payload))

    def set(self, key: str, value: str, ex: int | None = None) -> None:
        self.kv[key] = value

    def progress_events(self) -> list[dict]:
        """Decode the published progress events."""
        return [json.loads(payload) for _, payload in self.published]


def _make_photo(path: str = "/tmp/job/photo.jpg"):
    return types.SimpleNamespace(filepath=path, latitude=17.46888, longitude=104.91277)


def _install_fake_wikipicture(monkeypatch, *, on_commons) -> None:
    """Inject fake wikipicture submodules used by process_photos."""
    photo = _make_photo()
    cluster = types.SimpleNamespace(center_lat=17.46888, center_lon=104.91277, photos=[photo])

    modules = {
        "wikipicture": types.ModuleType("wikipicture"),
        "wikipicture.clustering": types.ModuleType("wikipicture.clustering"),
        "wikipicture.commons_checker": types.ModuleType("wikipicture.commons_checker"),
        "wikipicture.exif_extractor": types.ModuleType("wikipicture.exif_extractor"),
        "wikipicture.geocoder": types.ModuleType("wikipicture.geocoder"),
        "wikipicture.quality_filter": types.ModuleType("wikipicture.quality_filter"),
        "wikipicture.scorer": types.ModuleType("wikipicture.scorer"),
        "wikipicture.wiki_analyzer": types.ModuleType("wikipicture.wiki_analyzer"),
    }

    modules["wikipicture.exif_extractor"].extract_metadata = lambda p: photo
    modules["wikipicture.clustering"].cluster_photos = lambda metas: [cluster]
    # reverse_geocode returns a bare object so _format_location_name falls back
    # to the coordinate string (no place_name/city/etc. attributes).
    modules["wikipicture.geocoder"].reverse_geocode = lambda lat, lon: object()
    modules["wikipicture.wiki_analyzer"].search_articles = lambda name, lat, lon: []
    modules["wikipicture.commons_checker"].check_commons_saturation = on_commons
    modules["wikipicture.quality_filter"].assess_quality = lambda fp: MagicMock()
    modules["wikipicture.scorer"].score_opportunity = lambda *a, **k: MagicMock()
    modules["wikipicture.scorer"].rank_opportunities = lambda opps: list(opps)

    for name, mod in modules.items():
        monkeypatch.setitem(sys.modules, name, mod)


def test_tracking_send_flags_429(monkeypatch):
    """The transport hook records a 429 response."""
    monkeypatch.setattr(
        process, "_orig_adapter_send", lambda self, request, *a, **k: MagicMock(status_code=429)
    )
    process._reset_rate_limit()
    assert process._rate_limit_hit() is False

    process._tracking_send(MagicMock(), MagicMock())
    assert process._rate_limit_hit() is True


def test_tracking_send_ignores_success(monkeypatch):
    """A normal response leaves the flag untouched."""
    monkeypatch.setattr(
        process, "_orig_adapter_send", lambda self, request, *a, **k: MagicMock(status_code=200)
    )
    process._reset_rate_limit()
    process._tracking_send(MagicMock(), MagicMock())
    assert process._rate_limit_hit() is False


def test_process_photos_rate_limited(monkeypatch):
    """A swallowed upstream 429 surfaces as a failed job with a warning message."""
    fake_redis = FakeRedis()
    monkeypatch.setattr(process.redis_lib, "from_url", lambda url: fake_redis)

    # Simulate the underlying transport returning 429 (as the library would see
    # before swallowing it) when Commons saturation is checked.
    monkeypatch.setattr(
        process, "_orig_adapter_send", lambda self, request, *a, **k: MagicMock(status_code=429)
    )

    def commons_hits_429(lat, lon):
        # The real library performs an HTTP request here; route it through the
        # actual transport hook so the 429 is recorded the same way it is in
        # production, then return an empty result (the library swallows it).
        process._tracking_send(MagicMock(), MagicMock())
        return MagicMock()

    _install_fake_wikipicture(monkeypatch, on_commons=commons_hits_429)

    result = process.process_photos.apply(args=["job-429", ["/tmp/job/photo.jpg"]]).get()

    # Job is marked failed and produced no opportunities.
    assert fake_redis.kv["job:job-429:status"] == "failed"
    assert result == {"job_id": "job-429", "total_photos": 1, "opportunities": []}

    # A rate_limited progress event carrying the friendly message was published.
    events = fake_redis.progress_events()
    rate_limited = [e for e in events if e["step"] == "rate_limited"]
    assert len(rate_limited) == 1
    assert rate_limited[0]["message"] == process.RATE_LIMIT_MESSAGE


def test_process_photos_no_rate_limit_completes(monkeypatch):
    """Without a 429 the job completes normally (sanity check on the happy path)."""
    fake_redis = FakeRedis()
    monkeypatch.setattr(process.redis_lib, "from_url", lambda url: fake_redis)
    monkeypatch.setattr(process, "save_results", lambda job_id, data: None)
    monkeypatch.setattr(process, "save_report", lambda job_id, html: None)
    monkeypatch.setattr(
        "app.report.generate_report", lambda data: "<html></html>", raising=False
    )
    # No thumbnail work for the fake opportunity.
    monkeypatch.setattr(process, "generate_thumbnail", lambda fp, max_size=200: None)

    _install_fake_wikipicture(monkeypatch, on_commons=lambda lat, lon: MagicMock())

    result = process.process_photos.apply(args=["job-ok", ["/tmp/job/photo.jpg"]]).get()

    assert fake_redis.kv["job:job-ok:status"] == "done"
    assert result["job_id"] == "job-ok"
    steps = {e["step"] for e in fake_redis.progress_events()}
    assert "rate_limited" not in steps
    assert "done" in steps

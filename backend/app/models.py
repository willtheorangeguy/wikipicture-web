from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from pydantic import BaseModel


class JobStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    DONE = "done"
    FAILED = "failed"


@dataclass
class ProgressEvent:
    job_id: str
    step: str
    current: int
    total: int
    message: str


class WikiArticleOut(BaseModel):
    title: str
    url: str
    image_count: int
    needs_photo: bool


class CommonsOut(BaseModel):
    nearby_image_count: int
    saturation: str


class QualityOut(BaseModel):
    megapixels: float
    overall_suitable: bool


class OpportunityOut(BaseModel):
    filename: str
    latitude: float
    longitude: float
    location_name: str
    score: float
    recommendation: str
    reasons: list[str]
    best_article: WikiArticleOut | None = None
    commons: CommonsOut | None = None
    quality: QualityOut | None = None
    thumbnail_b64: str | None = None


class JobResponse(BaseModel):
    job_id: str
    status: JobStatus
    message: str


class ResultsResponse(BaseModel):
    job_id: str
    total_photos: int
    opportunities: list[OpportunityOut]

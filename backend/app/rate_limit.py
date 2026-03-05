from fastapi import HTTPException

from app.config import settings


class RateLimiter:
    def __init__(self, redis_client) -> None:
        self.redis = redis_client

    async def check_upload_rate(self, ip: str) -> None:
        # Block if there's already an active job from this IP
        active_key = f"active_job:{ip}"
        if await self.redis.exists(active_key):
            raise HTTPException(status_code=429, detail="A job is already active for this IP")

        # Sliding-window: uploads per hour
        hour_key = f"uploads_hour:{ip}"
        uploads_this_hour = await self.redis.incr(hour_key)
        if uploads_this_hour == 1:
            await self.redis.expire(hour_key, 3600)
        if uploads_this_hour > settings.rate_limit_uploads_per_hour:
            raise HTTPException(status_code=429, detail="Upload rate limit exceeded (hourly)")

        # Sliding-window: photos per day
        day_key = f"photos_day:{ip}"
        photos_today = await self.redis.get(day_key)
        photos_today = int(photos_today) if photos_today else 0
        if photos_today >= settings.rate_limit_photos_per_day:
            raise HTTPException(status_code=429, detail="Photo rate limit exceeded (daily)")

    async def add_photos(self, ip: str, count: int) -> None:
        """Increment the daily photo counter by count."""
        day_key = f"photos_day:{ip}"
        new_val = await self.redis.incrby(day_key, count)
        if new_val == count:
            # Key was just created; set TTL to end of day (86400 s)
            await self.redis.expire(day_key, 86400)

    def set_active_job(self, ip: str, job_id: str) -> None:
        self.redis.set(f"active_job:{ip}", job_id, ex=settings.job_ttl_seconds)

    def clear_active_job(self, ip: str) -> None:
        self.redis.delete(f"active_job:{ip}")

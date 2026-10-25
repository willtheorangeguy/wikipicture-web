import asyncio

from fakeredis.aioredis import FakeRedis
from fastapi import HTTPException

from app.rate_limit import RateLimiter


def test_concurrent_uploads_reserve_only_one_slot():
    async def scenario():
        redis = FakeRedis(decode_responses=True)
        limiter = RateLimiter(redis)
        results = await asyncio.gather(
            limiter.set_active_job("client", "first"),
            limiter.set_active_job("client", "second"),
            return_exceptions=True,
        )
        assert sum(result is None for result in results) == 1
        rejected = [result for result in results if isinstance(result, HTTPException)]
        assert len(rejected) == 1
        assert rejected[0].status_code == 429
        assert await redis.get("active_job:client") in {"first", "second"}
        await redis.aclose()
    asyncio.run(scenario())


def test_stale_delete_cannot_release_newer_job():
    async def scenario():
        redis = FakeRedis(decode_responses=True)
        limiter = RateLimiter(redis)
        await limiter.set_active_job("client", "new-job")
        await limiter.clear_active_job("client", "old-job")
        assert await redis.get("active_job:client") == "new-job"
        await limiter.clear_active_job("client", "new-job")
        assert await redis.get("active_job:client") is None
        await redis.aclose()
    asyncio.run(scenario())

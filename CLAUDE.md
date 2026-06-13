# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WikiPicture Web is a drag-and-drop web interface for the [wikipicture](https://pypi.org/project/wikipicture/) Python library, which analyzes photos and identifies opportunities to contribute them to Wikipedia/Wikimedia Commons. Users upload photos, a Celery worker runs the analysis pipeline, and results are streamed back in real time via Server-Sent Events.

## Commands

### Backend (Python / FastAPI)

Run from the `backend/` directory:

```bash
# Install (including test extras)
pip install -e ".[test]"

# Run dev server
uvicorn app.main:app --reload --port 8000

# Run all tests
pytest

# Run a single test file
pytest tests/test_process_rate_limit.py

# Run a single test by name
pytest tests/test_process_rate_limit.py::test_function_name -v
```

### Frontend (React / Vite)

Run from the `frontend/` directory:

```bash
npm install
npm run dev        # Vite dev server on port 5173, proxies /api → localhost:8000
npm run build      # tsc + vite build → dist/
npm run preview    # Preview production build
```

### E2E Tests (Playwright)

Requires the full Docker Compose stack to be running first:

```bash
# Start the stack
docker compose up -d

# Wait for health check, then run E2E tests
cd e2e
npm install
npx playwright install chromium
npx playwright test

# Run a specific spec
npx playwright test tests/upload.spec.ts

# View HTML report (after a run)
npx playwright show-report
```

### Docker / Full Stack

```bash
# Production stack
docker compose up -d

# Development stack (with hot reload)
docker compose -f docker-compose.dev.yml up

# Rebuild after code changes
docker compose build
```

## Architecture

### Request Lifecycle

1. User uploads photos → `POST /api/upload` (validated by MIME magic bytes, rate-limited)
2. Backend dispatches a Celery task, returns `job_id`
3. Frontend opens an SSE connection to `GET /api/job/{job_id}` and renders a progress bar
4. Celery worker runs the pipeline (see below) and publishes progress events to Redis pub/sub
5. On completion, frontend fetches `GET /api/results/{job_id}` for the ranked opportunities table
6. User can download an HTML report via `GET /api/download/{job_id}` and then delete the job via `DELETE /api/job/{job_id}`

### Backend Structure (`backend/app/`)

| File | Responsibility |
|---|---|
| `main.py` | FastAPI app factory, lifespan (Redis connection pool), CORS |
| `config.py` | Pydantic `Settings` — all env vars with defaults |
| `models.py` | Pydantic models shared between routers and tasks |
| `rate_limit.py` | `RateLimiter` class — Redis sliding-window counters (active jobs, uploads/hour, photos/day) |
| `storage.py` | File I/O helpers — job dirs in `/tmp/wikipicture/{job_id}/`, results JSON, HTML report caching |
| `report.py` | HTML report generation |
| `routers/upload.py` | File validation, rate limiting, Celery task dispatch |
| `routers/jobs.py` | SSE stream: subscribes to Redis pub/sub channel for the job |
| `routers/results.py` | Fetch results, stream download, delete job |
| `tasks/process.py` | Core Celery task: EXIF → cluster → geocode → Wikipedia → Commons saturation → quality → score → rank |

### Frontend Structure (`frontend/src/`)

`App.tsx` drives a simple state machine: `upload` → `processing` → `results`. State transitions are managed in the two custom hooks:

- `useUpload.ts` — wraps `uploadPhotos()`, holds upload errors and the returned `job_id`
- `useProgress.ts` — opens/closes an `EventSource` to the SSE endpoint; populates progress messages

All API calls go through `api/client.ts`; TypeScript types in `types.ts` mirror the backend Pydantic models exactly.

### State & Persistence

There is no traditional database. Redis is used for:
- **Job state** — `job:{id}:status` keys with TTL (`JOB_TTL_SECONDS`, default 3600)
- **Rate limiting** — sliding-window counters per IP
- **Celery broker + results backend**
- **Progress pub/sub** — Celery task publishes JSON events; the SSE router subscribes

Job files (uploaded photos, `results.json`, HTML report) live in `/tmp/wikipicture/{job_id}/` and are shared between the `backend` and `worker` containers via a Docker volume.

### Rate Limiting

Three independent Redis-backed limits (all per IP):
- 1 active job at a time
- 5 uploads per hour
- 100 photos per day

The Celery task also detects upstream HTTP 429s from Wikipedia/Wikimedia Commons/geocoder and re-raises them as a user-friendly error rather than retrying indefinitely.

### Services (Docker Compose)

| Service | Role |
|---|---|
| `redis` | Alpine Redis — broker, cache, pub/sub |
| `backend` | FastAPI + Uvicorn on port 8000 (internal) |
| `worker` | Celery worker (2 concurrency, prefetch=1) |
| `beat` | Celery Beat — cleans up expired jobs every 10 minutes |
| `nginx` | Reverse proxy on 80/443 — serves React SPA, proxies `/api/*` to backend, passes SSE with no buffering and 300 s read timeout |

### CI

`.github/workflows/ci.yml` runs on every push/PR to main:
- **Backend**: `pip install -e ".[test]"` → `python -c "from app.main import app"` → `pytest`
- **Frontend**: `npm install` → `npm run build`

`.github/workflows/e2e.yml` spins up the full Docker Compose stack, waits for `/api/health`, runs Playwright on Chromium, and uploads the HTML report + traces on failure.

## Key Environment Variables

Defined in `.env.example` and read via `backend/app/config.py` (Pydantic Settings):

| Variable | Default | Purpose |
|---|---|---|
| `REDIS_URL` | `redis://redis:6379/0` | Redis connection string |
| `ALLOWED_ORIGINS` | — | CORS origins (comma-separated) |
| `ENVIRONMENT` | `production` | Affects CORS / debug behaviour |
| `JOB_TTL_SECONDS` | `3600` | How long job data is kept in Redis/disk |
| `MAX_PHOTOS_PER_UPLOAD` | `50` | Hard cap enforced at upload |
| `max_upload_bytes` | `104857600` (100 MB) | Total upload size limit |
| `rate_limit_uploads_per_hour` | `5` | Per-IP hourly upload cap |
| `rate_limit_photos_per_day` | `100` | Per-IP daily photo cap |

## Deployment

The recommended deployment target is **Fly.io** with three separate apps (`wikipicture` for nginx/frontend, `wikipicture-api` for FastAPI, `wikipicture-worker` for Celery) plus **Upstash Redis**. Configuration lives in `fly.toml`. Docker images are built and pushed to GHCR by `.github/workflows/docker-publish.yml` on each release.

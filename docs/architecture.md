# WikiPicture Web — Architecture

```
browser
  └── nginx :80
        ├── /api/*  →  FastAPI (uvicorn)
        │                 ├── Redis   rate limits, job state
        │                 └── disk    {temp_dir}/{job_id}/
        │                        ↕
        │              Celery worker  →  wikipicture package  →  Nominatim / Wikipedia / Commons
        └── /*      →  React SPA (static)
```

## Why a worker

Analysis is slow and rate-limited upstream — a geocode per cluster, one second apart. Doing that
inside the request would hold an HTTP connection open for minutes.

So `POST /api/upload` writes the files, dispatches a Celery task, and returns a job ID
immediately. The browser then opens a **Server-Sent Events** stream at `GET /api/job/{id}`.

Progress flows worker → Redis pub/sub (`job:{id}:progress`) → the SSE handler → the browser. That
indirection is what lets the API and the worker be separate processes: the worker never talks to
a client, it publishes, and whichever API instance holds the connection relays.

## The pieces

| Component | Responsibility |
|---|---|
| `main.py` | App construction, CORS, the Redis pool's lifespan |
| `config.py` | Settings from environment or `.env` |
| `routers/upload.py` | Validation, storage, dispatch |
| `routers/jobs.py` | SSE progress stream, via Redis pub/sub |
| `routers/results.py` | JSON results, HTML download, deletion |
| `rate_limit.py` | Per-IP counters in Redis |
| `storage.py` | Job directories, results, cleanup |
| `tasks/process.py` | The Celery task, and the cleanup beat schedule |
| `report.py` | HTML rendering |

## Storage

A job is a directory: `{temp_dir}/{job_id}/`, holding the uploaded photos, `results.json`, and
`report.html`.

The backend writes it and the **worker** reads it, so the path must be a shared volume — a
Docker volume in compose, the `uploads` mount in `fly.toml`. Two containers with separate
filesystems is the classic way to break this deployment, and the symptom is a worker that cannot
find files the API says it wrote.

Photos are on **disk**, not in memory. That is unavoidable given the worker boundary, and worth
being accurate about when describing the service to its users.

## Redis

Three jobs at once:

| Use | Keys |
|---|---|
| Rate limiting | `uploads_hour:{ip}`, `photos_day:{ip}`, `active_job:{ip}` |
| Job status | `job:{id}:status` |
| Progress pub/sub | Channel `job:{id}:progress` |
| Celery broker | Task queue |
| Result backend | Task state |

`aioredis` from `main.py`'s lifespan for the API; the synchronous client inside Celery.

## Cleanup

`process.py` registers a beat schedule:

```python
celery_app.conf.beat_schedule = {
    "cleanup_old_jobs": {"task": "cleanup_old_jobs", "schedule": 600.0},
}
```

Every ten minutes, deleting job directories older than `JOB_TTL_SECONDS`.

A schedule needs a **beat process** to fire it. `docker-compose.yml` runs one; the Fly.io
instructions do not. Recorded in [`internal/known-issues.md`](./internal/known-issues.md).

Results can also be deleted early via `DELETE /api/job/{id}`, which `results.py` calls after a
successful fetch.

## nginx

The public entry point: SPA static files, `/api/*` proxied to the backend, SPA fallback for
client-side routes. `fly.toml` builds `nginx/Dockerfile` as the deployed app.

It also carries the SSE-specific configuration — buffering off and a long read timeout — without
which the progress stream is buffered into silence until the job finishes. Any replacement proxy
needs the same.

That layering is why the frontend needs no backend URL — it calls `/api` relatively, and nginx
decides where that goes.

## Frontend

React and Vite. In development, `vite.config.ts` proxies `/api` to :8000; in production nginx
does the same job. `nginx-spa.conf` handles the SPA fallback.

## Testing

| Suite | Covers |
|---|---|
| `backend/tests/` | Rate-limit behaviour in the processing path |
| `e2e/tests/` | Playwright: upload, results, download, errors, rate limits |

The end-to-end suite is where this project's coverage really lives — it drives a running stack,
which for a system of five services is the level that catches wiring mistakes.

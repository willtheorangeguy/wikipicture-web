# WikiPicture Web — Documentation

A web front end for the WikiPicture CLI: upload photos in a browser, get back the same
Wikipedia-opportunity analysis as an HTML report.

```
wikipicture-web/
├── backend/app/
│   ├── main.py            FastAPI app, Redis pool, CORS
│   ├── config.py          pydantic-settings
│   ├── rate_limit.py      per-IP limits in Redis
│   ├── storage.py         job directories on disk
│   ├── routers/           upload, jobs, results
│   └── tasks/process.py   the Celery worker and the cleanup beat task
├── frontend/              React + Vite SPA
├── nginx/                 reverse proxy, the public entry point
├── e2e/                   Playwright specs
├── docker-compose.yml     nginx, backend, worker, beat, redis
└── fly.toml               Fly.io config for the nginx app
```

## Pages

- [Quickstart](./quickstart.md) — running it locally
- [Installation](./installation.md) — Docker, and the development mode
- [Configuration](./configuration.md) — every environment variable
- [Architecture](./architecture.md) — request to report
- [API](./api.md) — the three endpoints
- [Development](./development.md) — tests, hot reload, layout
- [Deployment](./deployment.md) — Fly.io and the alternatives
- [FAQ](./faq.md) — privacy, limits, formats
- [Troubleshooting](./troubleshooting.md) — uploads, jobs, Redis
- [Roadmap](./roadmap.md) — direction and non-goals
- [Known issues](./internal/known-issues.md) — recorded defects

## Read this before deploying it publicly

This service accepts file uploads from anonymous users. Three recorded issues bear directly on
that, and are detailed in [`internal/known-issues.md`](./internal/known-issues.md):

- **Upload filenames are used as path components without sanitisation.** The variable is called
  `safe_name`, and nothing makes it safe.
- **The "one active job per IP" limit never takes effect** — the Redis write that sets it is a
  coroutine that is never awaited.
- **The documented Fly.io deployment has no Celery beat process**, so the hourly cleanup task
  never runs and uploaded photos are not deleted.

None of these prevent the service working on a trusted network. All three matter the moment
strangers can reach it.

## What happens to an uploaded photo

| Stage | Where |
|---|---|
| Received | FastAPI, checked for JPEG/HEIC magic bytes |
| Stored | **On disk**, at `{temp_dir}/{job_id}/` — a volume shared with the worker |
| Processed | The Celery worker, via the `wikipicture` package |
| Deleted | By an explicit result-fetch, or the cleanup task after `JOB_TTL_SECONDS` |

Note the second row: photos are written to disk, not held in memory. The distinction matters for
anything you tell your users — see [FAQ](./faq.md).

During analysis the photo's **coordinates** are sent to Nominatim, Wikipedia, and Commons, as in
the CLI. The images themselves are never uploaded anywhere.

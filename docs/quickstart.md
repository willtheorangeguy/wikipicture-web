# WikiPicture Web — Quickstart

## Run it

```bash
docker compose up --build
```

From the repository root — `docker-compose.yml` lives there.

Then open <http://localhost>.

This starts five services: nginx, the FastAPI backend, a Celery worker, a Celery **beat**
scheduler, and Redis. Beat is what runs the cleanup task; leaving it out means uploads are never
deleted.

## Use it

1. Drag JPEG or HEIC photos onto the page — up to 50 per upload, 100 MB in total.
2. The job is queued and processed in the background.
3. When it finishes, download the HTML report.

Photos without GPS are skipped, exactly as in the CLI: the analysis is entirely location-driven.

## Development mode

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up backend worker redis
```

Then, in another terminal:

```bash
cd frontend
npm install
npm run dev
```

| | |
|---|---|
| Frontend | <http://localhost:5173> |
| API | <http://localhost:8000> |

The backend reloads on change; the Vite dev server proxies API calls.

## Configuration

```bash
cp .env.example .env
```

The two worth setting are `ALLOWED_ORIGINS` and `REDIS_URL`. Everything else has a working
default — see [Configuration](./configuration.md).

## Limits

| Limit | Default |
|---|---|
| Photos per upload | 50 |
| Bytes per upload | 100 MB |
| Uploads per IP per hour | 5 |
| Photos per IP per day | 100 |
| Active jobs per IP | 1 — but see [`internal/known-issues.md`](./internal/known-issues.md) |
| Result retention | 1 hour |

## Stopping

```bash
docker compose down          # keep the volumes
docker compose down -v       # and drop uploaded photos and Redis state
```

# WikiPicture Web — Installation

## Requirements

| | |
|---|---|
| Docker + Compose | The supported path |
| Node 18+ | Only for frontend development |
| Python 3.11+ | Only for backend development outside Docker |

## Docker

```bash
git clone https://github.com/willtheorangeguy/wikipicture-web.git
cd wikipicture-web
docker compose up --build
```

<http://localhost>.

Five services come up:

| Service | Role |
|---|---|
| `nginx` | Public entry point; serves the SPA and proxies `/api/*` |
| `backend` | FastAPI under uvicorn |
| `worker` | Celery worker running the analysis |
| `beat` | Celery scheduler — runs the cleanup task every 10 minutes |
| `redis` | Rate limits, Celery broker, results |

**`beat` is not optional if you care about the retention promise.** Without it the cleanup task
never fires and uploaded photos stay on the volume indefinitely. Whether a given deployment runs
it is worth checking; the Fly.io instructions do not — see [Deployment](./deployment.md).

## Development mode

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up backend worker redis
```

Backend on :8000 with hot reload. Then:

```bash
cd frontend
npm install
npm run dev        # :5173
```

Note this combination omits `beat`, which is fine for development.

## Configuration

```bash
cp .env.example .env
```

| Variable | Why you would set it |
|---|---|
| `ALLOWED_ORIGINS` | Must list the frontend's origin, or the browser blocks API calls |
| `REDIS_URL` | Anything other than the compose-internal Redis |

Everything else is documented in [Configuration](./configuration.md).

## Storage

Uploads and results live under `temp_dir`, which defaults to
`{system temp}/wikipicture` — `/tmp/wikipicture` in the containers. The backend and worker share
it as a Docker volume, and `fly.toml` mounts it as `uploads`.

It **must** be shared: the backend writes the photos, and a different container reads them.

## Verify

```bash
curl http://localhost/api/health
docker compose ps          # five services, all up
docker compose logs beat   # cleanup ticking every 10 minutes
```

Then upload a photo through the UI and confirm a report comes back.

## Tests

```bash
cd backend && pytest
cd e2e && npm install && npx playwright test
```

The Playwright suite drives a running stack — start it first.

## Uninstall

```bash
docker compose down -v
```

`-v` removes the volumes, and with them any uploaded photos still on disk.

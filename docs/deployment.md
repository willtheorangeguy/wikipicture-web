# WikiPicture Web — Deployment

## Self-hosting with Docker

```bash
docker compose up --build
```

One command, five services, everything wired. This is the simplest correct deployment, because
`docker-compose.yml` includes the **beat** scheduler that the managed instructions below omit.

## Fly.io

Roughly $2–5/month for a small always-on instance, with free SSL and anycast.

### Prerequisites

- [flyctl](https://fly.io/docs/hands-on/install-flyctl/)
- A Fly.io account

### The shape

| App | What it runs |
|---|---|
| `wikipicture-web` | nginx + the React build (`fly.toml`, `nginx/Dockerfile`) |
| `wikipicture-api` | FastAPI |
| `wikipicture-worker` | Celery worker |
| **`wikipicture-beat`** | Celery beat — **needed, and not in the original instructions** |

Plus Redis via **Upstash** (free tier).

Each is its own `fly launch` app, communicating over Fly's private network
(`<appname>.internal`) or public `fly.dev` URLs.

### 1. Redis

```bash
fly extensions upstash create --name wikipicture-redis
# note the REDIS_URL
```

### 2. API

```bash
cd backend
fly launch --name wikipicture-api --no-deploy
fly secrets set REDIS_URL="<upstash-url>" ALLOWED_ORIGINS="https://wikipicture-web.fly.dev"
fly deploy
```

### 3. Worker

```bash
fly launch --name wikipicture-worker --no-deploy
fly secrets set REDIS_URL="<upstash-url>"
# fly.toml:
#   [[processes]]
#   command = "celery -A app.tasks.process.celery_app worker"
fly deploy
```

### 4. Beat — do not skip this

```bash
fly launch --name wikipicture-beat --no-deploy
fly secrets set REDIS_URL="<upstash-url>"
# fly.toml:
#   [[processes]]
#   command = "celery -A app.tasks.process.celery_app beat"
fly deploy
```

Without a beat process the `cleanup_old_jobs` schedule never fires. Uploaded photos stay on the
volume indefinitely, and `JOB_TTL_SECONDS` becomes decorative. Recorded in
[`internal/known-issues.md`](./internal/known-issues.md).

### 5. Frontend and nginx

```bash
fly launch --name wikipicture-web --no-deploy
# set API_URL to https://wikipicture-api.fly.dev in fly.toml
fly deploy
```

Note `fly.toml` currently declares `app = "wikipicture"` while these instructions use
`wikipicture-web`. Reconcile them, or `fly deploy` targets an app you did not mean.

### Shared storage

The API and the worker must see the same `temp_dir`. `fly.toml` mounts a volume named `uploads`
at `/tmp/wikipicture` — the worker app needs an equivalent mount, or it will not find the files
the API wrote.

## Alternatives

| Provider | Monthly | Notes |
|---|---|---|
| Fly.io | $0–5 | Best DX, native Docker |
| Railway | $5 | Easy, good GitHub integration |
| Render | $0–7 | Free tier sleeps after 15 minutes |
| DigitalOcean App Platform | $5 | Simple, reliable |
| Hetzner VPS + Docker | $4 | Cheapest; `docker compose up` and done |

The VPS option has a real advantage here: it runs `docker-compose.yml` as written, so beat and
the shared volume come for free rather than being things to remember.

## Before going public

This service takes file uploads from anonymous users. Read
[`internal/known-issues.md`](./internal/known-issues.md) first — the upload filename is used
unsanitised as a path component, the concurrent-job limit does not take effect, and the client IP
used for rate limiting is taken from an unvalidated `X-Forwarded-For` header.

That last one is only sound behind a proxy that **overwrites** the header rather than appending
to it. Check your proxy's configuration, and do not expose the API app directly if the limits
matter.

## Updating the wikipicture package

```bash
# backend/pyproject.toml: wikipicture>=X.Y.Z
fly deploy
```

Both the API and the worker need redeploying — the worker is the one that actually runs it.

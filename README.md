# WikiPicture Web

## Overview

WikiPicture Web is a drag-and-drop web interface for the [WikiPicture CLI tool](https://pypi.org/project/wikipicture/). Upload photos and get the same Wikipedia-powered analysis you know from the CLI — all through a browser, no terminal required.

---

## Quick Start (Self-Hosting with Docker)

### Prerequisites

- Docker and Docker Compose installed

### Run locally

```bash
cd web
docker compose up --build
```

Open http://localhost

### Run in development mode

```bash
# Start backend + Redis with hot-reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up backend worker redis

# In another terminal, start the frontend dev server
cd frontend
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:8000

### Configuration

Copy `.env.example` to `.env` and set:

| Variable | Description |
|----------|-------------|
| `ALLOWED_ORIGINS` | Comma-separated list of allowed frontend origins |
| `REDIS_URL` | Redis connection string |

---

## Deploying to Fly.io (Recommended Managed Hosting)

Fly.io offers ~$2–5/month for a small always-on instance with free SSL, global anycast, and easy scaling.

### Prerequisites

- Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
- Create a Fly.io account

### Architecture on Fly.io

The recommended setup runs three Fly.io apps:

1. `wikipicture-web` — nginx + React frontend (this app, using `fly.toml`)
2. `wikipicture-api` — FastAPI backend
3. `wikipicture-worker` — Celery worker

And one Redis service via **Upstash** (free tier).

> **Note:** Each service is deployed as its own `fly launch` app. They communicate over Fly.io's private network (`<appname>.internal`) or via their public `fly.dev` URLs.

### Step-by-step deployment

#### 1. Set up Redis (Upstash)

```bash
# Install Upstash plugin
fly extensions upstash create --name wikipicture-redis
# Note the REDIS_URL from the output
```

#### 2. Deploy the API backend

```bash
cd backend
fly launch --name wikipicture-api --no-deploy
fly secrets set REDIS_URL="<your-upstash-url>" ALLOWED_ORIGINS="https://wikipicture-web.fly.dev"
fly deploy
```

#### 3. Deploy the Celery worker

```bash
# Same image as backend, different start command
fly launch --name wikipicture-worker --no-deploy
fly secrets set REDIS_URL="<your-upstash-url>"
# Edit fly.toml to use:
#   [[processes]]
#   command = "celery -A app.tasks.process.celery_app worker"
fly deploy
```

#### 4. Deploy the frontend/nginx

```bash
cd ..
fly launch --name wikipicture-web --no-deploy
# Edit fly.toml: set API_URL to https://wikipicture-api.fly.dev
fly deploy
```

### Updating the wikipicture package version

When a new version of the `wikipicture` CLI is released on PyPI:

1. Update `backend/pyproject.toml`: `wikipicture>=X.Y.Z`
2. Redeploy: `fly deploy`

---

## Alternative Hosting Options

| Provider | Monthly Cost | Notes |
|----------|-------------|-------|
| **Fly.io** (recommended) | $0–5 | Best DX, native Docker, free tier |
| Railway | $5 | Very easy, great GitHub integration |
| Render | $0–7 | Free tier sleeps after 15 min inactivity |
| DigitalOcean App Platform | $5 | Simple, reliable |
| Hetzner VPS + Docker | $4 | Cheapest, manual setup |

---

## Architecture

```
User → nginx (port 80/443)
         ├── /api/* → FastAPI (uvicorn)
         │              └── Celery worker (background processing)
         │                     └── wikipicture PyPI package
         └── /* → React SPA (static files)

Redis: rate limiting + Celery broker + job results
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://redis:6379/0` | Redis connection string |
| `ALLOWED_ORIGINS` | `http://localhost` | CORS allowed origins |
| `ENVIRONMENT` | `production` | `production` or `development` |
| `JOB_TTL_SECONDS` | `3600` | How long to keep results (seconds) |
| `MAX_PHOTOS_PER_UPLOAD` | `50` | Maximum photos per upload |

---

## Rate Limits

- 5 uploads per IP per hour
- 100 photos per IP per day
- 1 active job per IP at a time

---

## Privacy

All uploaded photos are processed in memory and permanently deleted after 1 hour. No images are stored permanently or shared with third parties.

# WikiPicture Web — Configuration

Environment variables, read by `pydantic-settings` from the environment or a `.env` file.

## Variables

| Variable | Default | Description |
|---|---|---|
| `REDIS_URL` | `redis://redis:6379/0` | Rate limits, Celery broker, results |
| `ALLOWED_ORIGINS` | `http://localhost:3000,http://localhost` | CORS origins |
| `ENVIRONMENT` | `production` | `production` or `development` |
| `JOB_TTL_SECONDS` | `3600` | Retention for results and uploads |
| `MAX_PHOTOS_PER_UPLOAD` | `50` | Photos in one upload |
| `MAX_UPLOAD_BYTES` | `104857600` | 100 MB total per upload |
| `RATE_LIMIT_UPLOADS_PER_HOUR` | `5` | Per IP |
| `RATE_LIMIT_PHOTOS_PER_DAY` | `100` | Per IP |
| `TEMP_DIR` | `{system temp}/wikipicture` | Job directories |

### `ALLOWED_ORIGINS`

Accepts a comma-separated list **or** a JSON array string — `config.py` handles both, because
`pydantic-settings` would otherwise try to `json.loads` a plain string and fail.

```bash
ALLOWED_ORIGINS=https://wikipicture-web.fly.dev
ALLOWED_ORIGINS=http://localhost:5173,http://localhost
```

Set it to the exact origin your frontend is served from. It does not restrict who can call the
API — CORS is a browser mechanism, not an access control.

### `TEMP_DIR`

Resolved from the platform temp directory rather than hardcoded to `/tmp`, so it works on
Windows during development.

**Backend and worker must share it.** The backend writes uploads; the worker reads them from a
different container. In compose that is a volume; in `fly.toml` it is the `uploads` mount at
`/tmp/wikipicture`.

### `JOB_TTL_SECONDS`

Two things: how long the Redis active-job key lives, and the age at which the cleanup task
deletes a job directory.

The cleanup task only runs if a **Celery beat** process is running. Without one, this setting has
no effect on disk at all — see [Deployment](./deployment.md).

## Rate limits

Enforced in Redis, per client IP:

| Key | Meaning |
|---|---|
| `uploads_hour:{ip}` | Counter, 1 hour TTL |
| `photos_day:{ip}` | Counter, 24 hour TTL |
| `active_job:{ip}` | Presence blocks a second concurrent job |

The client IP comes from `X-Forwarded-For` when present, falling back to the socket address. The
header is **not** validated against a trusted proxy list, so it is only meaningful when a proxy
you control overwrites it — see [`internal/known-issues.md`](./internal/known-issues.md).

The `active_job` key is never written; same file.

## Upload validation

| Check | Where |
|---|---|
| MIME from the first 512 bytes, via libmagic | `routers/upload.py` |
| Allowed: `image/jpeg`, `image/heic`, `image/heif` | `ALLOWED_MIME_TYPES` |
| Photo count | `MAX_PHOTOS_PER_UPLOAD` |
| Total size | `MAX_UPLOAD_BYTES` |

Type detection reads the file's own magic bytes rather than trusting the extension or the
declared content type — the right approach. The **filename** is not validated at all.

## Frontend

`frontend/vite.config.ts` proxies `/api` to the backend in development. In production nginx does
it, and the SPA uses relative URLs, so no backend address is baked into the bundle.

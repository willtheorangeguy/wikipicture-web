# WikiPicture Web — API

FastAPI, all under `/api`, all unauthenticated. nginx proxies `/api/*` to the backend.

## `GET /api/health`

```json
{ "status": "ok" }
```

Used by the Fly.io health check. No dependencies, so it answers even when Redis is down.

## `POST /api/upload`

`multipart/form-data`, field `photos`, repeated.

**Checks, in order:**

1. Rate limits for the client IP.
2. Photo count against `MAX_PHOTOS_PER_UPLOAD`.
3. Each file's MIME type, detected with libmagic from the first 512 bytes — `image/jpeg`,
   `image/heic`, `image/heif` only.
4. Total size against `MAX_UPLOAD_BYTES`.

Then a job directory is created, the files are written, and a Celery task is dispatched.

```json
{ "job_id": "…uuid…", "status": "queued", "message": "Processing 12 photos" }
```

| Status | Meaning |
|---|---|
| 200 | Queued |
| 413 | Total upload too large |
| 422 | Too many photos, or an unsupported type |
| 429 | Rate limited |

Detecting the type from magic bytes rather than the filename or the declared content type is the
right call — a `.jpg` extension proves nothing. Note that the **filename** receives no such
scrutiny; see [`internal/known-issues.md`](./internal/known-issues.md).

## `GET /api/job/{job_id}`

Poll for status.

```json
{ "job_id": "…", "status": "processing", "progress": 40 }
```

Statuses: `queued`, `processing`, `completed`, `failed`.

## `GET /api/results/{job_id}`

The scored opportunities as JSON, once the job is `completed`. Same shape as the CLI's scoring
output — score, breakdown, best article, Commons result, quality.

## `GET /api/download/{job_id}`

The rendered HTML report, as a file download.

## `DELETE /api/job/{job_id}`

Deletes the job directory and everything in it — the way to remove your photos before the TTL
expires.

Note it takes only a job ID and no credential. A job ID is a UUID4, so it is not guessable, but
anyone holding one can delete the job. That is the same property that lets the frontend do it.

## Rate limits

| Limit | Default |
|---|---|
| Uploads per IP per hour | 5 |
| Photos per IP per day | 100 |
| Concurrent jobs per IP | 1 (not currently enforced — see known issues) |

Exceeding one gives 429 with a message naming which.

The client IP is taken from `X-Forwarded-For` when present, with no trusted-proxy allowlist, so
these limits hold only behind a proxy that overwrites the header.

## CORS

`ALLOWED_ORIGINS` controls the browser-facing policy. It restricts what a **browser** will let a
page do; it is not access control, and a direct client ignores it entirely.

## Upstream APIs

The worker calls Nominatim, Wikipedia, and Commons through the `wikipicture` package, with its
rate limiting and User-Agent policy — see that project's documentation. Photo **coordinates** go
out; photos do not.

# WikiPicture Web — Troubleshooting

## The page loads but uploads fail

**Check CORS first.** If the browser console says the request was blocked by CORS policy, the
frontend's origin is not in `ALLOWED_ORIGINS`:

```bash
ALLOWED_ORIGINS=http://localhost:5173,http://localhost
```

It accepts a comma-separated list or a JSON array.

## 422 Unsupported file type

Type detection uses libmagic on the first 512 bytes, so the extension is irrelevant. Only
`image/jpeg`, `image/heic`, and `image/heif` are accepted.

A PNG renamed to `.jpg` is correctly rejected. So is a truncated or zero-byte file, whose magic
bytes do not match anything.

## 413 Upload too large

Total across the request exceeds `MAX_UPLOAD_BYTES` (100 MB). Split it.

## 429 Rate limited

The message names which limit. Defaults: 5 uploads per hour and 100 photos per day per IP.

Behind a proxy, everyone can appear as one IP — or the header can be set by the client. See the
`X-Forwarded-For` note in [Configuration](./configuration.md).

## The job stays "queued" forever

The worker is not consuming. Check, in order:

```bash
docker compose ps                  # is the worker up?
docker compose logs worker         # is it connected to Redis?
docker compose logs redis
```

A worker that starts and then idles usually means a `REDIS_URL` mismatch between the API and the
worker — they must point at the same instance, or tasks are queued where nobody is listening.

## The job fails immediately

```bash
docker compose logs worker
```

Most common: the worker cannot read the uploaded files. The API writes to `temp_dir` and the
worker reads from it, so the two **must share a volume**. Separate filesystems produce exactly
this — an API that reports success and a worker that finds nothing.

## Results are empty

Photos without GPS are skipped. Confirm with any EXIF viewer. Also possible: the locations have
no Wikipedia articles nearby.

## Uploaded photos are not being deleted

The cleanup task runs on a **Celery beat** schedule, and beat is a separate process. Check it is
running:

```bash
docker compose ps beat
docker compose logs beat
```

The Fly.io instructions in earlier versions of this repository did not deploy one. Recorded in
[`internal/known-issues.md`](./internal/known-issues.md).

## More than one job at a time from the same IP

The "one active job per IP" limit does not currently take effect — the Redis write that sets it
is never awaited. Recorded in [`internal/known-issues.md`](./internal/known-issues.md).

## `docker compose up` cannot find the compose file

Run it from the repository root. `docker-compose.yml` is there — earlier documentation told you
to `cd web` first, and no such directory exists.

## nginx returns 502

The backend is not reachable. Check it is up and healthy:

```bash
docker compose logs backend
curl http://localhost:8000/api/health
```

## Redis connection refused

Confirm the service is up and `REDIS_URL` matches. Inside compose the host is the service name
(`redis://redis:6379/0`), not `localhost`.

## Playwright tests fail to connect

They drive a running stack. Start the services first, then run the suite.

## Fly.io: worker cannot find files

The API and worker apps need the same volume mounted at the same path. `fly.toml` mounts
`uploads` at `/tmp/wikipicture` for the nginx app; the worker app needs its own equivalent. See
[Deployment](./deployment.md).

## Still stuck

[Open an issue](https://github.com/willtheorangeguy/wikipicture-web/issues/new/choose) with the
failing request, the relevant `docker compose logs` output, and whether you are running compose
or a managed deployment.

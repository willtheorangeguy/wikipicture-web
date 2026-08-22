# Known Issues — wikipicture-web

Concrete defects and gaps found while writing this repository's documentation in
August 2026. **Nothing here was changed** — each one needs a code, configuration, or
licensing decision rather than a documentation one.

Ordered by severity. See [`docs/roadmap.md`](../roadmap.md) for the narrative version,
which also covers deliberate non-goals.

**5 open:** 3 high, 1 medium, 1 low.

## 1. Upload filenames are used unsanitised as path components

**Severity:** High
**Where:** `backend/app/routers/upload.py` -> `upload_photos`; `backend/app/storage.py` -> `save_upload`

**What:** The router does `safe_name = photo.filename or f"photo_{len(file_contents)}.jpg"` and passes it to `save_upload`, which does `dest = job_dir / filename` followed by `dest.write_bytes(data)`. Nothing strips directory separators or `..` segments. `pathlib`'s `/` operator additionally **replaces** the base when the right-hand side is absolute, so a filename of `/etc/cron.d/x` resolves to `/etc/cron.d/x` rather than to anything under the job directory. Starlette does not sanitise `UploadFile.filename` -- it is the value from the multipart `Content-Disposition` header, and only browsers strip paths from it.

**Why it matters:** This is an unauthenticated, public-facing upload endpoint whose whole purpose is accepting files from strangers. An attacker can write bytes of their choosing to an arbitrary path with the API process's privileges, subject only to the content starting with JPEG or HEIC magic bytes -- enough to clobber configuration, drop files into a served directory, or destroy another job's `results.json` by targeting `../{other-job-id}/results.json`. The variable being named `safe_name` is what makes this invisible on review: the code reads as though sanitisation happened somewhere.

**Suggested fix:** Discard the client filename entirely and generate your own -- an index plus the extension implied by the detected MIME type. If the original name must be preserved for the report, store it as metadata rather than as a path. At minimum use `os.path.basename` and reject any name that is not a simple filename.

## 2. The one-active-job-per-IP limit never takes effect

**Severity:** High
**Where:** `backend/app/rate_limit.py` -> `set_active_job`; `backend/app/routers/upload.py`

**What:** `set_active_job` is declared `def`, not `async def`, and its body is `self.redis.set(f"active_job:{ip}", job_id, ex=settings.job_ttl_seconds)`. The client is `redis.asyncio`, so `.set()` returns a coroutine rather than performing the write. The caller invokes it as `rate_limiter.set_active_job(ip, job_id)` with no `await`, so the coroutine is created, never scheduled, and garbage-collected. The `active_job:{ip}` key is therefore never written, and `check_upload_rate`'s `if await self.redis.exists(active_key)` is always false.

**Why it matters:** The concurrency limit is documented in the README, the API, and the rate-limit table, and it does nothing. Its purpose is to stop one client queueing many simultaneous jobs against a worker pool of two -- the control that protects the service from being trivially saturated, and the one that shields the rate-limited upstream APIs from a burst. The only outward sign is a `RuntimeWarning: coroutine 'set' was never awaited` in the logs, which is easy to miss among uvicorn's output. The hourly and daily counters still work, so the limits look partially functional.

**Suggested fix:** Make the method `async def` and `await` both the call and the invocation. Then add a test: `backend/tests/` covers the other two limits and not this one, which is why it survived.

## 3. The documented Fly.io deployment has no beat process, so cleanup never runs

**Severity:** High
**Where:** `README.md` Fly.io section (corrected in this pass), `backend/app/tasks/process.py`, `docker-compose.yml`

**What:** `process.py` registers `celery_app.conf.beat_schedule` with a `cleanup_old_jobs` task every 600 seconds, which deletes job directories older than `JOB_TTL_SECONDS`. A beat schedule requires a **beat process** to fire it. `docker-compose.yml` runs one (`celery ... beat`); the Fly.io instructions deployed three apps -- web, api, worker -- and no beat.

**Why it matters:** The README stated: 'All uploaded photos are processed in memory and permanently deleted after 1 hour.' On the deployment it recommends, neither half held. Photos are written to disk in a shared volume, and with no beat process nothing ever deletes them -- so a public instance accumulates strangers' photographs indefinitely while telling them the opposite. The failure is entirely silent: the API works, jobs complete, and only the volume grows. Anyone relying on that privacy statement is relying on a process that was never deployed.

**Suggested fix:** Deploy a fourth Fly app running `celery -A app.tasks.process.celery_app beat` (documented in `docs/deployment.md` as part of this pass). More robustly, delete expired jobs lazily on access as well, so retention does not depend on a separate process being remembered. And correct the privacy wording to say photos are stored on disk.

## 4. X-Forwarded-For is trusted without a proxy allowlist

**Severity:** Medium
**Where:** `backend/app/routers/upload.py` -> `upload_photos`

**What:** `forwarded_for = request.headers.get("X-Forwarded-For")` and `ip = forwarded_for.split(",")[0].strip() if forwarded_for else request.client.host`. The header is accepted from any client, with no trusted-proxy list and no check that the request arrived through a proxy at all.

**Why it matters:** Every rate limit keys on this value, so a client that sets its own `X-Forwarded-For` chooses its own identity and can reset all three limits per request. Behind an nginx that overwrites the header this is fine -- but the recommended Fly.io topology deploys the API as its own public app (`wikipicture-api.fly.dev`) reachable without going through the nginx app at all, and `ALLOWED_ORIGINS` is a browser-side control that does nothing to a direct client. So the documented deployment is one where the limits can be bypassed by anyone who reads them.

**Suggested fix:** Take the client IP from a configurable trusted-proxy chain (`ProxyHeadersMiddleware` with an explicit `trusted_hosts`, or Starlette's `TrustedHostMiddleware` plus explicit handling), falling back to `request.client.host` when the request did not come from a known proxy. Separately, do not expose the API app publicly if the limits are meant to hold.

## 5. The quickstart told you to cd into a directory that does not exist

**Severity:** Low
**Where:** `README.md` (corrected in this pass), `fly.toml`

**What:** The Quick Start read `cd web` then `docker compose up --build`. There is no `web/` directory -- `docker-compose.yml` is at the repository root. `fly.toml` carries the same assumption in a comment: 'Build context is the web/ directory'. Separately, `fly.toml` declares `app = "wikipicture"` while the deployment instructions use `fly launch --name wikipicture-web`.

**Why it matters:** The very first command in the README fails with 'no such file or directory', which is a poor first impression for a project whose selling point is that self-hosting is one command. The leftovers suggest the project was extracted from a monorepo where it lived under `web/`; the `fly.toml` app-name mismatch is the same class and has a worse failure mode, since `fly deploy` will happily target whichever app the file names.

**Suggested fix:** The README is fixed in this pass. Update the `fly.toml` comment and reconcile the `app` value with the documented `--name`.

---

## Also, across every repository

**`.bandit` is present on disk but untracked in git.** Verified in PyWorkout, treklogger,
skyscanner-cli, booking-cli, piggy, and aibot — the config file exists locally in each but
`git ls-files` does not know about it, so none of it reached GitHub.

The August 2026 security sweep therefore looks complete locally and landed nowhere. Worth
checking across all 44 repositories it covered.

# WikiPicture Web — FAQ

## What happens to my photos?

They are uploaded, written to **disk** in a job directory, read by a worker for analysis, and
deleted — either when you fetch your results, or by the cleanup task after `JOB_TTL_SECONDS`
(one hour by default).

Two caveats worth knowing:

- They are stored on disk, not held in memory.
- The cleanup only runs if the deployment includes a Celery **beat** process. See
  [`internal/known-issues.md`](./internal/known-issues.md).

You can delete a job yourself at any time with `DELETE /api/job/{job_id}`.

## Are my photos sent to Wikipedia?

No. As in the CLI, only the **coordinates** derived from each photo's EXIF are sent — to
Nominatim, Wikipedia, and Commons, to ask what is at that place. The images themselves never
leave the server.

## Do I need an account?

No. There is no authentication, which is also why there are per-IP rate limits.

## What formats are accepted?

JPEG and HEIC/HEIF, verified by magic bytes rather than the file extension. A renamed PNG is
rejected.

## What are the limits?

| Limit | Default |
|---|---|
| Photos per upload | 50 |
| Total upload size | 100 MB |
| Uploads per IP per hour | 5 |
| Photos per IP per day | 100 |
| Concurrent jobs per IP | 1 — currently not enforced |

All configurable — see [Configuration](./configuration.md).

## Why were some of my photos ignored?

They had no GPS in EXIF. The entire analysis is location-driven, so a photo without coordinates
cannot be placed. Editors and messaging apps commonly strip EXIF.

## Why is it slow?

Geocoding is capped at one request per second upstream, and time scales with the number of
distinct **places**, not photos. Fifty photos of one street is quick; fifty photos of fifty
places is not.

## Can I run it myself?

Yes — `docker compose up --build`. See [Installation](./installation.md), and read
[Deployment](./deployment.md) before exposing it to anyone else.

## Is it safe to put on the internet?

Not as it stands. Three recorded issues bear on that directly, including an unsanitised upload
filename used as a path component. See
[`internal/known-issues.md`](./internal/known-issues.md).

## What is the difference from the CLI?

The same analysis, without a terminal. The CLI is better for large libraries — no upload, no
per-IP limits, and results cached locally between runs.

## Where do results go?

`results.json` and `report.html` in the job directory, served through the API and deleted with
the job.

## Why is Redis needed?

Three roles: rate-limit counters, the Celery broker, and task results. Losing it loses in-flight
jobs and resets the limits.

# WikiPicture Web — Roadmap

Direction, not a schedule. Defects are tracked in
[`internal/known-issues.md`](./internal/known-issues.md); this page is about what the service is
*for*.

## Where it is

Upload, queue, process, report — working, with rate limits, magic-byte type checking, a job TTL,
and an end-to-end Playwright suite. One `docker compose up` brings up the whole stack correctly.

## Considered

**Sanitising upload filenames.** The single most important change. The upload path uses the
client-supplied filename as a path component under a variable named `safe_name`, and nothing
makes it safe.

**Making the concurrent-job limit work.** `set_active_job` is a synchronous method calling an
async Redis client without awaiting, so the key is never written and the limit never applies.

**A trusted-proxy allowlist.** `X-Forwarded-For` is taken at face value, so a direct client can
choose its own rate-limit identity.

**Deployment instructions that include beat.** Now corrected in
[Deployment](./deployment.md), but the underlying fragility remains: nothing detects that
cleanup has stopped running.

**A retention check that does not depend on beat.** Deleting expired jobs lazily on access would
make the TTL true regardless of how the deployment is arranged.

**Progress detail.** The job endpoint reports a percentage; per-photo or per-stage progress would
make a long job legible.

**Backend test coverage.** One test file against five modules. The Playwright suite carries most
of the weight, which is reasonable but leaves the routers' edge cases untested.

## Non-goals

**Accounts and authentication.** It is a drop-a-photo-get-a-report tool; per-IP limits are the
appropriate control for that shape. Adding accounts means storing people.

**Long-term storage.** Photos and reports are deleted after an hour by design. Keeping them means
becoming a photo host, with everything that implies.

**Uploading to Commons.** Same as the CLI: Commons has licensing and scope rules a person should
read, and an automated uploader would produce contributions that get reverted.

**Replacing the CLI.** For a large library the CLI is better — no upload, no rate limits, and a
local cache between runs. This exists for people who will not open a terminal.

**Scaling to arbitrary load.** The limits are deliberately low. A public instance of this is a
volunteer-funded API's client, and being a good citizen upstream matters more than throughput.

## Contributing

Issues and pull requests welcome — see the
[Contributing Guide](https://github.com/willtheorangeguy/.github/blob/main/CONTRIBUTING.md).
Filename sanitisation is a few lines and the highest-value change available.

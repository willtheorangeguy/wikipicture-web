# WikiPicture Web — Development

## Running

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up backend worker redis
```

Backend on :8000 with hot reload. Then:

```bash
cd frontend
npm install
npm run dev        # :5173, proxying /api to :8000
```

This combination omits `beat`, which is fine while developing — nothing is cleaned up, which is
usually what you want when inspecting a job directory.

## Layout

```text
backend/app/
├── main.py        app, CORS, Redis lifespan
├── config.py      settings
├── models.py      pydantic request/response models
├── rate_limit.py  per-IP Redis counters
├── storage.py     job directories
├── report.py      HTML rendering
├── routers/       upload, jobs, results
└── tasks/         the Celery task and beat schedule
frontend/src/      React
e2e/tests/         Playwright
nginx/             production proxy
```

## Tests

```bash
cd backend && pytest
cd e2e && npm install && npx playwright test
```

`backend/tests/test_process_rate_limit.py` covers rate limiting in the processing path.

The Playwright suite — `upload`, `results`, `download`, `error-handling`, `rate-limit` — drives a
**running stack**, so bring the services up first. For a system of five components, that is where
the real coverage is: the failures worth catching here are wiring failures, and a unit test
cannot see them.

## Conventions

- **Settings through `config.py`.** Never read `os.environ` elsewhere; `pydantic-settings`
  handles types and the `.env` file.
- **Async in the API, sync in the worker.** The API uses `redis.asyncio`; Celery tasks use the
  synchronous client. Mixing them is the shape of at least one recorded bug — an async call in a
  sync method is silently a no-op.
- **Storage paths only through `storage.py`.** It owns the job-directory layout.
- **Validate content, not filenames.** Type detection uses libmagic on the bytes. Filenames are
  attacker-controlled and currently unsanitised; see
  [`internal/known-issues.md`](./internal/known-issues.md).
- **The API and the worker must share `temp_dir`.** Anything that writes a file the other reads
  goes through the shared volume.

## Adding an endpoint

Put it in a router under `backend/app/routers/`, define request and response models in
`models.py`, and rate-limit it if it does real work. Then add a Playwright spec — that is the
level at which a new endpoint is actually exercised.

## Frontend

React with Vite and TypeScript. `vite.config.ts` proxies `/api`; production uses relative URLs
through nginx, so no backend address is ever baked into the bundle.

## Recording defects

Bugs found while working here go in [`internal/known-issues.md`](./internal/known-issues.md)
rather than being fixed in passing, unless fixing them is the job you are on.

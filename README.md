<!-- Logo -->
<h1 align="center">WikiPicture Web</h1>

<!-- Copy -->
<h4 align="center">A drag-and-drop web front end for WikiPicture — upload photos, get back the Wikipedia articles they could illustrate.</h4>

<!-- Badges -->
<div align="center">
  <img alt="GitHub Issues" src="https://img.shields.io/github/issues/willtheorangeguy/wikipicture-web">
  <img alt="GitHub Pull Requests" src="https://img.shields.io/github/issues-pr/willtheorangeguy/wikipicture-web">
  <img alt="License" src="https://img.shields.io/github/license/willtheorangeguy/wikipicture-web">
</div>

<!-- Navigation -->
<p align="center">
  <a href="#key-features">Key Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#documentation">Documentation</a> •
  <a href="#support">Support</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#credits">Credits</a> •
  <a href="#license">License</a>
</p>

<!-- Screenshot -->
<div align="center">
  <img src="https://raw.githubusercontent.com/willtheorangeguy/.github/main/icons/wikipicture-web/main.png" alt="WikiPicture Web">
</div>

## Key Features

- The same analysis as the [WikiPicture CLI](https://pypi.org/project/wikipicture/), with no terminal.
- Drag and drop JPEG or HEIC photos; results arrive as a downloadable HTML report.
- Uploads are processed asynchronously by a Celery worker, so the browser is not held open.
- File type is checked from magic bytes rather than the extension.
- Per-IP rate limits and a job TTL, for a service meant to be exposed to other people.
- Self-hosted with one `docker compose up`, or spread across Fly.io apps.

## Installation

```bash
docker compose up --build
```

Then open <http://localhost>. See [`docs/installation.md`](docs/installation.md).

## Usage

Drop photos onto the page, wait for the job to finish, and download the report.

## Documentation

Full documentation lives in [`docs/`](docs/README.md):
[Quickstart](docs/quickstart.md) · [Installation](docs/installation.md) · [Configuration](docs/configuration.md) · [Architecture](docs/architecture.md) · [API](docs/api.md) · [Development](docs/development.md) · [Deployment](docs/deployment.md) · [FAQ](docs/faq.md) · [Troubleshooting](docs/troubleshooting.md) · [Roadmap](docs/roadmap.md)

> **Before exposing this to the internet**, read [`docs/internal/known-issues.md`](docs/internal/known-issues.md). There is an unsanitised upload filename, a rate-limit control that does not take effect, and a documented deployment that omits the cleanup scheduler.

## Support

Open a [GitHub Discussion](https://github.com/willtheorangeguy/wikipicture-web/discussions/new) or file an [issue](https://github.com/willtheorangeguy/wikipicture-web/issues/new/choose).

## Contributing

Contributions welcome. See the org-wide [Contributing Guide](https://github.com/willtheorangeguy/.github/blob/main/CONTRIBUTING.md) and [Code of Conduct](https://github.com/willtheorangeguy/.github/blob/main/CODE_OF_CONDUCT.md).

## Credits

Analysis by [WikiPicture](https://github.com/willtheorangeguy/wikipicture). Built with [FastAPI](https://fastapi.tiangolo.com/), [Celery](https://docs.celeryq.dev/), [Redis](https://redis.io/), [React](https://react.dev/), and [nginx](https://nginx.org/). Tested end to end with [Playwright](https://playwright.dev/).

## License

MIT — see [`LICENSE.md`](LICENSE.md).

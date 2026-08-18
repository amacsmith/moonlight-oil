# Running the Stack

Skip the Windows installer and run the compose stack directly. Requires Docker (or Podman) with Compose.

## Prerequisites

- Docker Desktop or Podman with Compose plugin
- WSL2 (on Windows)

## Quick Start

```bash
cd stack
cp .env.example .env
# Edit .env and set a long random STORYTELLER_SECRET_KEY
docker compose up -d          # or: podman compose up -d
```

Then open [http://localhost:8080](http://localhost:8080).

## Services

| Service | Port | Notes |
|---------|------|-------|
| `home` | 8080 | Static big-button landing page (Caddy) |
| `storyteller` | 8001 / 8002 | Official Storyteller image. Data in `stack/data/storyteller` |
| `flowstate` | 8003 | Built from source via `stack/flowstate/Dockerfile`. Frontend-only |

## Why FlowState is Built from Source {#why-flowstate-is-built-from-source}

FlowState Reader is a Create React App (react-scripts 3.1.1) with no backend, published only to GitHub Pages. There is no official container image. The Dockerfile:

- Builds on **Node 16** (which still links OpenSSL 1.1.1, so webpack 4's legacy crypto calls work without flags)
- Sets `CI=false` so lint warnings don't fail the build
- Sets `PUBLIC_URL=/` so assets resolve when served at the site root
- Forces `NPM_CONFIG_REGISTRY=https://registry.npmjs.org/` because upstream's lockfile pins a dead mirror
- Sets `SKIP_PREFLIGHT_CHECK=true` to bypass a harmless eslint version mismatch
- Serves the static `build/` with nginx and an SPA fallback for client-side routes

Pin a specific upstream commit for reproducibility:

```bash
FLOWSTATE_REF=<commit-sha> docker compose build flowstate
```

## Storyteller Specifics

Follows the [official self-hosting guide](https://storyteller-platform.dev/docs/installation/self-hosting/):

- `STORYTELLER_SECRET_KEY` is **required** — set your own when running by hand
- Books, database, covers, and transcriptions persist in the `/data` volume (`stack/data/storyteller`)
- `PUID`/`PGID` default to 1000 so files aren't owned by root

## Port Change Caveat

The home page reads the service host dynamically, but **ports are hard-coded** in the `PORTS` object in `stack/home/index.html`. If you change `STORYTELLER_PORT` or `FLOWSTATE_PORT` in `.env`, update that object to match.

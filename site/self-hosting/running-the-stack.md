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

## Changing Ports

Nothing to keep in sync. Change `STORYTELLER_PORT` or `FLOWSTATE_PORT` in `.env`, restart, and the home page follows — Caddy reads the values from the environment and publishes them at `/config.json`, which the page fetches on load.

::: tip This used to be a caveat
The ports were once written down twice: in `.env` and again in a `PORTS` object inside `index.html`, with a comment asking whoever changed one to remember the other. Config that has to be kept in sync by hand eventually isn't.
:::

## What Caddy Serves {#what-caddy-serves}

The `home` service is configured by [`stack/caddy/Caddyfile`](https://github.com/amacsmith/moonlight-oil/blob/main/stack/caddy/Caddyfile):

| Path | Purpose |
|------|---------|
| `/` | The home page and its scripts, from `stack/home/` |
| `/config.json` | The real ports plus `LAN_HOST`, so the page never hardcodes them |
| `/up/storyteller` | Reverse proxy to `storyteller:8001`, used as a liveness probe |
| `/up/flowstate` | Reverse proxy to `flowstate:80`, likewise |

The probes exist so the page can tell whether a service is listening *before* offering it as a button. They're same-origin, so the browser lets the page read the result — a direct `fetch` to `http://host:8001` would be opaque under CORS and couldn't distinguish "starting up" from "running". The page sends `HEAD`, so a probe costs a status line and nothing else.

Caddy answers `502` when the container behind it isn't listening; the page reads that as *not up yet* and anything else as *awake*.

```bash
curl -s http://localhost:8080/config.json
# {"homePort":8080,"storytellerPort":8001,"flowstatePort":8003,"lanHost":"192.168.1.42"}

curl -sI -o /dev/null -w '%{http_code}\n' http://localhost:8080/up/storyteller
# 200 once it's up, 502 while it isn't
```

## Reading on a Phone or Tablet {#reading-on-a-phone-or-tablet}

`launch.ps1` detects the PC's address on the home network and writes it to `LAN_HOST` in `.env` on every start (addresses change when the router hands out a new lease). The home page turns that into a QR code so a phone camera can carry the library across without anyone typing an IP.

Running the stack by hand? Set it yourself:

```bash
LAN_HOST=192.168.1.42 docker compose up -d
```

Leave it blank and the panel simply doesn't appear. Nothing else changes.

The address has to be one another device can actually reach — installing Docker or Podman adds virtual adapters with their own private addresses, and a QR code pointing at one of those goes nowhere. `Get-LanAddress` in `common.ps1` avoids them by asking Windows which interface carries the default route.

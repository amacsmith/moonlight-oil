# Self-hosting notes (for tinkerers)

This is the technical companion to the one-click installer. If you're comfortable
with a terminal you can run the stack directly and skip the `.exe` entirely.

## Run it without the installer

Requires Docker (or Podman) with Compose, and WSL2 on Windows.

```bash
cd stack
cp .env.example .env
# edit .env and set a long random STORYTELLER_SECRET_KEY
docker compose up -d          # or: podman compose up -d
```

Then open <http://localhost:8080>.

## Services

| Service | Port | Notes |
|---------|------|-------|
| `home` | 8080 | Static big-button landing page (Caddy serving `stack/home`). |
| `storyteller` | 8001 / 8002 | Official image `registry.gitlab.com/storyteller-platform/storyteller:latest`. Data in `stack/data/storyteller`. |
| `flowstate` | 8003 | Built from [PeggyZWY/flowstate-webapp](https://github.com/PeggyZWY/flowstate-webapp) via `stack/flowstate/Dockerfile`. Frontend-only, no data. |

Ports are configurable in `.env`.

## Why FlowState is built from source

FlowState Reader is a Create React App (react-scripts 3.1.1) with no backend,
published only to GitHub Pages. There is no official container. The Dockerfile:

- builds on **Node 16** with `NODE_OPTIONS=--openssl-legacy-provider` (webpack 4
  predates OpenSSL 3),
- sets `CI=false` so lint warnings don't fail the build,
- sets `PUBLIC_URL=/` so assets resolve when served at the site root (upstream's
  `homepage` points at a GitHub Pages subpath),
- serves the static `build/` with nginx and an SPA fallback for client-side routes.

Pin a specific upstream commit for reproducibility:

```bash
FLOWSTATE_REF=<commit-sha> docker compose build flowstate
```

## Storyteller specifics

Follows the official self-hosting guide
(<https://storyteller-platform.dev/docs/installation/self-hosting/>):

- `STORYTELLER_SECRET_KEY` is **required** — the installer generates one; set your
  own when running by hand.
- Books, database, covers and transcriptions persist in the `/data` volume
  (`stack/data/storyteller`).
- `PUID`/`PGID` default to 1000 so files aren't owned by root.

## Updating

```bash
cd stack
docker compose pull            # newer Storyteller image
docker compose build flowstate # rebuild FlowState from upstream
docker compose up -d
```

## Common tweaks

- **Different ports:** edit `.env`, then `compose up -d` again.
- **Access from other devices in the house:** the ports already bind to the PC's
  IP — browse to `http://<pc-ip>:8080` from another device on the same network.
- **Self-hosting FlowState at a different upstream/fork:** override
  `FLOWSTATE_REPO`/`FLOWSTATE_REF` build args in `stack/flowstate/Dockerfile` or
  via `docker compose build`.

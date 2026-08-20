# Contributing to Moonlight Oil

Thank you for helping make Dad's reading experience even better.

## Quick Start

```bash
git clone https://github.com/amacsmith/moonlight-oil.git
cd moonlight-oil

# Run the stack locally (requires Docker or Podman)
cd stack
cp .env.example .env
# Set STORYTELLER_SECRET_KEY to any long random string
docker compose up -d
# Open http://localhost:8080

# Run the tests (from repo root)
cd ..
npm test

# Run the docs site
cd site
npm install
npm run dev
```

## Branching Strategy

We use trunk-based development with short-lived feature branches.

| Branch pattern | Purpose |
|----------------|---------|
| `main` | Stable, release-ready |
| `feature/*` | New features |
| `fix/*` | Bug fixes |
| `docs/*` | Documentation |

### Workflow

1. Branch from `main`
2. Make changes, commit with clear messages
3. Push and open a PR against `main`
4. CI runs automatically (installer build, FlowState image build, tests, docs)
5. Squash-merge after review

## CI Checks

Every PR runs:

- **installer** (Windows) — compiles `MoonlightOilSetup.exe`
- **flowstate-image** (Ubuntu) — builds the FlowState Docker image
- **validate** (Ubuntu) — 186 tests over the compose config, Caddy config, home page, QR encoder, Dockerfile, installer scripts and env file
- **browser** (Ubuntu) — validates the Caddyfile with Caddy itself, then drives the real home page in headless Chromium
- **docs** (Ubuntu) — builds the VitePress documentation site

## Tests

```bash
npm test
```

Node's built-in `node:test` runner. No dependencies, no Docker, no Windows — it reads the source and checks it says the right things.

To also check the page *behaves*:

```bash
npm run caddy:check     # ask Caddy whether the Caddyfile is valid
npm run home:up         # start just the home service
npm run test:browser    # 22 checks in headless Chromium
npm run home:down
```

The browser suite runs with Storyteller and FlowState deliberately down, because "not listening yet" is the state the home page exists to handle well. Full detail in [the testing guide](site/contributing/testing.md).

## Releases

Tag `main` with `v1.0.0`, `v1.1.0`, etc. The CI workflow automatically attaches `MoonlightOilSetup.exe` to the GitHub Release.

## Branch Protection (Recommended)

For the `main` branch:

- Require PR reviews (1 approval)
- Require status checks: `installer`, `flowstate-image`, `validate`, `browser`, `docs`
- Require branches up to date before merging
- No force pushes or deletions

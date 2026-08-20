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
- **validate** (Ubuntu) — runs the test suite (compose, HTML, Dockerfile, installer, env validation)
- **docs** (Ubuntu) — builds the VitePress documentation site

## Tests

```bash
npm test
```

Tests use Node.js built-in test runner (`node:test`). No external dependencies needed. They validate project structure and configuration without requiring Docker.

## Releases

Tag `main` with `v1.0.0`, `v1.1.0`, etc. The CI workflow automatically attaches `MoonlightOilSetup.exe` to the GitHub Release.

## Branch Protection (Recommended)

For the `main` branch:

- Require PR reviews (1 approval)
- Require status checks: `installer`, `flowstate-image`, `validate`, `docs`
- Require branches up to date before merging
- No force pushes or deletions

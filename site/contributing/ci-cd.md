# CI/CD Pipeline

## Workflows

### `build-installer.yml` — Build & Release

Runs on every push and pull request.

| Job | Runner | What it does |
|-----|--------|-------------|
| `installer` | `windows-latest` | Compiles `MoonlightOilSetup.exe` with Inno Setup 6 |
| `flowstate-image` | `ubuntu-latest` | Smoke-tests that FlowState builds from source |

On `v*` tags, the installer job also attaches the `.exe` to the GitHub Release.

### `test.yml` — Validation

Runs on every push and pull request.

| Job | Runner | What it does |
|-----|--------|-------------|
| `validate` | `ubuntu-latest` | 186 tests: compose config, Caddy config, home page, QR encoder, Dockerfile, installer scripts, env file |
| `browser` | `ubuntu-latest` | `caddy validate` on the Caddyfile, then 22 checks driving the real page in headless Chromium against a live `home` container |
| `docs` | `ubuntu-latest` | Builds the VitePress documentation site |

The `browser` job starts only the `home` service and leaves Storyteller and FlowState down on purpose — see [Testing](/contributing/testing#why-both).

Compose interpolates the whole file on every invocation, not just the service named, so that job sets `STORYTELLER_SECRET_KEY` at the **job** level rather than on the `up` step. Otherwise the `logs` step on failure fails too, and hides the reason.

## Permissions

The workflows follow **least privilege**:

- Default: `contents: read`
- Release attachment: `contents: write` (only on the release job, only on tags)

## Artifacts

Every CI run produces:

- **MoonlightOilSetup.exe** — downloadable from the run's Artifacts tab
- On `v*` tags: automatically attached to the GitHub Release

## Running CI Checks Locally

```bash
# Validate compose config
docker compose -f stack/docker-compose.yml config

# Build the FlowState image
docker build -t moonlight-oil-flowstate:test stack/flowstate

# Run the test suite
npm test

# Check the Caddy config with Caddy itself
npm run caddy:check

# Drive the real page in a browser
npm run home:up && npm run test:browser && npm run home:down

# Build the docs
cd site && npm run build
```

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
| `validate` | `ubuntu-latest` | YAML lint, HTML validation, Dockerfile lint, compose config check |
| `docs` | `ubuntu-latest` | Builds the VitePress documentation site |

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

# Build the docs
cd site && npm run build
```

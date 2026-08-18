# Testing

## Test Suite

The test suite validates the project's configuration files and structure without needing Docker running or a Windows machine.

Run all tests:

```bash
npm test
```

## What's Tested

### Compose Validation
- `docker-compose.yml` is valid YAML
- All three services (`home`, `storyteller`, `flowstate`) are defined
- Required ports and volumes are configured
- Network is defined

### HTML Validation
- `index.html` is well-formed
- Required elements exist (cards, theme toggle, help dialog)
- Accessibility attributes are present (`aria-label`, `aria-hidden`)
- Dynamic hostname script is included (not hardcoded `localhost`)

### Dockerfile Validation
- FlowState Dockerfile uses multi-stage build
- Required environment variables are set (`CI=false`, `PUBLIC_URL=/`)
- npm registry override is present (avoids dead taobao mirror)
- nginx SPA fallback is configured

### Installer Script Validation
- Inno Setup `.iss` file has required sections
- PowerShell scripts have valid syntax
- `common.ps1` exports required functions

### Environment Config
- `.env.example` documents all required variables
- `STORYTELLER_SECRET_KEY` placeholder is present

## Adding Tests

Tests live in `tests/` and are plain Node.js scripts using the built-in `node:test` runner. No external test framework is needed.

```bash
# Run a specific test file
node --test tests/validate-compose.test.mjs
```
